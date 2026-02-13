
import React, { useState, useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  FileText,
  Loader2,
  Filter,
  X,
  Briefcase,
  ShieldAlert,
  MoreVertical,
  Send
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import TimesheetEntryForm from "../components/timesheets/TimesheetEntryForm";
import TimesheetList from "../components/timesheets/TimesheetList";
import AdminTimesheetDashboard from "../components/timesheets/AdminTimesheetDashboard";
import ApprovalDashboard from "../components/timesheets/ApprovalDashboard";
import SubmitTimesheetsDialog from "../components/timesheets/SubmitTimesheetsDialog";
import TimesheetReportGenerator from "../components/timesheets/TimesheetReportGenerator";
import AlarmsTab from "../components/timesheets/AlarmsTab";
import ReworkActionDialog from "../components/timesheets/ReworkActionDialog"; // Imp
import { toast } from "sonner";
import { useHasPermission } from "../components/shared/usePermissions";
import { useUser } from "../components/shared/UserContext";

import { useNavigate, useSearchParams } from "react-router-dom";

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
      tabParam === "alarms" ||
      tabParam === "rework-reviews"
      ? tabParam : "my-timesheets"
  );

  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showReworkActionDialog, setShowReworkActionDialog] = useState(false);
  const [showGoalReachedDialog, setShowGoalReachedDialog] = useState(false);
  const [selectedReworkEntry, setSelectedReworkEntry] = useState(null);
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
    enabled: !!currentUser && !!effectiveTenantId, // Enabled for all to support Peer Review selection
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
                date: newEntry.date || new Date().toLocaleDateString('en-CA'),
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

      // Trigger goal dialog if target met after this save
      setTimeout(() => {
        const updatedTotal = todayDraftMinutes + (newEntry?.total_minutes || 0);
        if (updatedTotal >= (workingHoursPerDay * 60)) {
          setShowGoalReachedDialog(true);
        }
      }, 500);
    },
    onError: (error) => {
      console.error('[Timesheets] Save error:', error);
      toast.error('Failed to save timesheet entry');
    },
  });

  const bulkSubmitMutation = useMutation({
    mutationFn: async (timesheetIds) => {
      const now = new Date().toISOString();
      await Promise.all(
        timesheetIds.map(async (id) => {
          const status = currentUser?.custom_role === 'owner' ? 'approved' :
            (currentUser?.custom_role === 'project_manager' ? 'pending_admin' : 'pending_pm');

          await groonabackend.entities.Timesheet.update(id, {
            status,
            submitted_at: now
          });
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets'] });
      toast.success("Timesheets submitted for approval!");
    },
    onError: (error) => {
      console.error('[Timesheets] Bulk submit error:', error);
      toast.error('Failed to submit timesheets');
    }
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

  // --- REWORK ALARM ALERT (Viewer Only) ---
  const { data: reworkAlarm } = useQuery({
    queryKey: ['rework-alarm', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return null;

      const [normalAlarms, highAlarms] = await Promise.all([
        groonabackend.entities.Notification.filter({
          recipient_email: currentUser.email,
          type: 'rework_alarm'
        }),
        groonabackend.entities.Notification.filter({
          recipient_email: currentUser.email,
          type: 'high_rework_alarm'
        })
      ]);

      const activeHigh = (highAlarms || []).find(a => a.status === 'OPEN' || a.status === 'APPEALED');
      if (activeHigh) return activeHigh;

      const activeNormal = (normalAlarms || []).find(a => a.status === 'OPEN' || a.status === 'APPEALED');
      return activeNormal || null;
    },
    enabled: !!currentUser?.email && currentUser?.custom_role === 'viewer',
    staleTime: 5000 // Refresh often
  });

  // Fetch INCOMING Peer Review Requests (New Schema)
  const { data: peerReviewRequests = [], refetch: refetchPeerReviews } = useQuery({
    queryKey: ['peer-review-requests', currentUser?.email],
    queryFn: async () => {
      const reqs = await groonabackend.entities.PeerReviewRequest.filter({
        reviewer_email: currentUser.email,
        status: 'PENDING'
      });
      return reqs || [];
    },
    enabled: !!currentUser?.email && currentUser?.custom_role === 'viewer',
    staleTime: 5000
  });

  // Handle Mark Review as Done
  const completeReviewMutation = useMutation({
    mutationFn: async (requestId) => {
      await groonabackend.entities.PeerReviewRequest.update(requestId, {
        status: 'COMPLETED',
        completed_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      toast.success("Review marked as complete");
      refetchPeerReviews();
    }
  });


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

  // Robust Daily Target Logic
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const todayDraftEntries = myDraftEntries.filter(t => t.date && t.date.substring(0, 10) === todayStr);
  const todayDraftMinutes = todayDraftEntries.reduce((sum, t) => {
    const mins = parseInt(t.total_minutes) || 0;
    return sum + mins;
  }, 0);

  const workingHoursPerDay = Number(currentUser?.working_hours_per_day) || 8;
  const isTargetMet = todayDraftMinutes >= (workingHoursPerDay * 60);

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
    <div className="flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 w-full relative">
      <div className="max-w-[1800px] mx-auto w-full flex flex-col relative">
        {/* Sticky Header Section */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200/60 pb-4 pt-6">
          <div className="px-6 md:px-8 pt-0 pb-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Timesheets</h1>
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
                      onClick={() => {
                        if (isTargetMet) {
                          setShowGoalReachedDialog(true);
                        } else {
                          setShowForm(true);
                          setEditingEntry(null);
                        }
                      }}
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
            <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
                    <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 flex-shrink-0 w-[240px] md:w-auto">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-600">{isRestrictedStats ? "My Total Hours" : "Total Hours"}</p>
                            <p className="text-2xl font-bold text-slate-900">
                              {isRestrictedStats ? myTotalHoursVal.toFixed(2) : totalHours.toFixed(2)}h
                            </p>
                          </div>
                          <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                            <Clock className="h-5 w-5 md:h-6 md:w-6 text-white" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {!isRestrictedStats && (
                      <>
                        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 flex-shrink-0 w-[240px] md:w-auto">
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-slate-600">Billable Hours</p>
                                <p className="text-2xl font-bold text-green-600">{billableHours.toFixed(2)}h</p>
                              </div>
                              <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                                <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-white" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 flex-shrink-0 w-[240px] md:w-auto">
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-slate-600">Non-Billable</p>
                                <p className="text-2xl font-bold text-purple-600">{nonBillableHours.toFixed(2)}h</p>
                              </div>
                              <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                <Clock className="h-5 w-5 md:h-6 md:w-6 text-white" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    )}
                    {/* Approved Card */}
                    <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 flex-shrink-0 w-[240px] md:w-auto">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-600">{isRestrictedStats ? "My Approved" : "Approved"}</p>
                            <p className="text-2xl font-bold text-green-600">
                              {isRestrictedStats ? myApprovedCountVal : approvedCount}
                            </p>
                          </div>
                          <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                            <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-white" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Submitted Card */}
                    <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 flex-shrink-0 w-[240px] md:w-auto">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-600">{isRestrictedStats ? "My Submitted" : "Submitted"}</p>
                            <p className="text-2xl font-bold text-amber-600">
                              {isRestrictedStats ? mySubmittedCountVal : submittedCount}
                            </p>
                          </div>
                          <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                            <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-white" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Drafts Card */}
                    <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 flex-shrink-0 w-[240px] md:w-auto">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-600">{isRestrictedStats ? "My Drafts" : "Drafts"}</p>
                            <p className="text-2xl font-bold text-slate-600">
                              {isRestrictedStats ? myDraftCountVal : draftCount}
                            </p>
                          </div>
                          <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center">
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
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="px-4 md:px-6 lg:px-8 pt-2 pb-2 border-t border-slate-200/60">
                  <div className="flex flex-col xl:flex-row items-center justify-between gap-4">
                    <TabsList className="bg-white/80 backdrop-blur-xl border border-slate-200 w-full xl:w-auto flex flex-wrap h-auto p-1 gap-1">
                      <TabsTrigger value="my-timesheets" className="gap-2 flex-1 xl:flex-none">
                        {isAdmin || isPM ? <Briefcase className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                        {isAdmin || isPM ? "All Timesheets" : "My Timesheets"}
                      </TabsTrigger>
                      <TabsTrigger value="drafts" className="gap-2 flex-1 xl:flex-none relative">
                        <FileText className="h-4 w-4" />
                        Drafts
                        {myDraftCount > 0 && (
                          <Badge className="ml-1 bg-slate-500 text-white px-1.5 h-5 min-w-[1.25rem]">
                            {myDraftCount}
                          </Badge>
                        )}
                      </TabsTrigger>
                      {currentUser?.custom_role === 'viewer' && (
                        <>
                          <TabsTrigger value="rework-info" className="gap-2 flex-1 xl:flex-none">
                            <AlertCircle className="h-4 w-4" />
                            Rework Info
                          </TabsTrigger>
                          <TabsTrigger value="rework-reviews" className="gap-2 flex-1 xl:flex-none relative">
                            <Users className="h-4 w-4" />
                            Rework Reviews
                            {peerReviewRequests.length > 0 && (
                              <Badge className="ml-1 bg-amber-500 text-white px-1.5 h-5 min-w-[1.25rem]">
                                {peerReviewRequests.length}
                              </Badge>
                            )}
                          </TabsTrigger>
                        </>
                      )}
                      {(isAdmin || isPM) && (
                        <>
                          <TabsTrigger value="approvals" className="gap-2 flex-1 xl:flex-none">
                            <CheckCircle className="h-4 w-4" />
                            Approvals
                            {pendingApprovals > 0 && (
                              <Badge className="ml-1 bg-amber-500 text-white">
                                {pendingApprovals}
                              </Badge>
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="alarms" className="gap-2 flex-1 xl:flex-none">
                            <ShieldAlert className="h-4 w-4" />
                            Alarms
                            {appealedAlarmsCount > 0 && (
                              <Badge className="ml-1 bg-amber-500 text-white">
                                {appealedAlarmsCount}
                              </Badge>
                            )}
                          </TabsTrigger>
                        </>
                      )}
                      {isAdmin && (
                        <>
                          <TabsTrigger value="team-timesheets" className="gap-2 flex-1 xl:flex-none">
                            <Users className="h-4 w-4" />
                            Team Overview
                          </TabsTrigger>
                          <TabsTrigger value="reports" className="gap-2 flex-1 xl:flex-none">
                            <FileText className="h-4 w-4" />
                            Reports
                          </TabsTrigger>
                        </>
                      )}
                    </TabsList>

                    {/* Filters - Only show for my-timesheets tab */}
                    {activeTab === "my-timesheets" && (
                      <div className="flex flex-wrap items-center gap-2 ml-auto w-full xl:w-auto justify-end">
                        <div className="flex items-center gap-1.5 flex-shrink-0 mr-2">
                          <Filter className="h-4 w-4 text-slate-600" />
                          <span className="text-sm font-medium text-slate-600">Filters:</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">

                          {/* User Filter (For Admin/PM/Owner) */}
                          {(isAdmin || isPM) && (
                            <Select value={userFilter} onValueChange={setUserFilter}>
                              <SelectTrigger className="h-9 w-[150px] text-sm bg-white/80 backdrop-blur-xl border-slate-200">
                                <SelectValue placeholder="All Users" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Users</SelectItem>
                                {users.map((u) => (
                                  <SelectItem key={u.id} value={u.email}>
                                    <div className="flex items-center gap-2">
                                      <Avatar className="h-6 w-6 ring-2 ring-slate-400 ring-offset-1">
                                        <AvatarImage src={u.profile_image_url} />
                                        <AvatarFallback className="text-[10px] bg-slate-100">
                                          {u.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="truncate text-slate-600 font-medium">{u.full_name || u.email}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-9 w-[130px] text-sm bg-white/80 backdrop-blur-xl border-slate-200">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Status</SelectItem>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="submitted">Submitted</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select value={projectFilter} onValueChange={setProjectFilter}>
                            <SelectTrigger className="h-9 w-[140px] text-sm bg-white/80 backdrop-blur-xl border-slate-200">
                              <SelectValue placeholder="Project" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Projects</SelectItem>
                              {uniqueProjects.map(([id, name]) => (
                                <SelectItem key={id} value={id}>{name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                            <SelectTrigger className="h-9 w-[130px] text-sm bg-white/80 backdrop-blur-xl border-slate-200">
                              <SelectValue placeholder="Date Range" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Time</SelectItem>
                              <SelectItem value="today">Today</SelectItem>
                              <SelectItem value="week">Last 7 Days</SelectItem>
                              <SelectItem value="month">Last 30 Days</SelectItem>
                            </SelectContent>
                          </Select>

                          {hasActiveFilters && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearFilters}
                              className="h-9 px-3 text-sm text-slate-600 hover:bg-slate-100"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Clear
                            </Button>
                          )}
                        </div>
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
              <div className="px-6 md:px-8 pt-6 pb-6 md:pb-8">
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
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              {/* Scrollable Content */}
              <div className="flex-1">
                <div className="px-6 md:px-8 pt-6 pb-6 md:pb-8">
                  <TabsContent value="my-timesheets" className="space-y-4 mt-4">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      <TimesheetList
                        timesheets={filteredTimesheets.filter(t => t.status !== 'draft')}
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

                  <TabsContent value="drafts" className="space-y-6 mt-4">
                    {isTargetMet && (
                      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 overflow-hidden shadow-sm">
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-green-200">
                                <CheckCircle className="h-6 w-6" />
                              </div>
                              <div>
                                <h3 className="text-lg font-bold text-green-900 leading-tight">Great work for today!</h3>
                                <p className="text-green-700 text-sm mt-1">
                                  You've logged {Math.floor(todayDraftMinutes / 60)}h {todayDraftMinutes % 60}m. Ready to finalize your daily timesheet?
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-3 w-full md:w-auto">
                              <Button
                                onClick={() => bulkSubmitMutation.mutate(todayDraftEntries.map(e => e.id))}
                                disabled={bulkSubmitMutation.isPending || todayDraftEntries.length === 0}
                                className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-100"
                              >
                                {bulkSubmitMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4 mr-2" />
                                )}
                                Submit All for Today
                              </Button>
                              <Button
                                variant="outline"
                                className="flex-1 md:flex-none border-green-200 text-green-700 hover:bg-green-100"
                                onClick={() => toast.info("No problem! You can keep adding entries.")}
                              >
                                Keep Drafting
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <TimesheetList
                      timesheets={myDraftEntries}
                      currentUser={currentUser}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      users={users}
                      showActions={true}
                      groupByDate={true}
                    />
                  </TabsContent>

                  {currentUser?.custom_role === 'viewer' && (
                    <TabsContent value="rework-info" className="space-y-4 mt-4">
                      {/* Alert Banner Logic */}
                      {reworkAlarm && reworkAlarm.status === 'OPEN' && (
                        <div className={`border-l-4 p-4 rounded-md shadow-sm flex items-center justify-between mb-4 ${reworkAlarm.type === 'high_rework_alarm' ? 'bg-red-100 border-red-600' : 'bg-red-50 border-red-500'
                          }`}>
                          <div className="flex items-center gap-3">
                            <ShieldAlert className={`h-6 w-6 ${reworkAlarm.type === 'high_rework_alarm' ? 'text-red-700 animate-pulse' : 'text-red-600'}`} />
                            <div>
                              <h3 className={`font-bold ${reworkAlarm.type === 'high_rework_alarm' ? 'text-red-900' : 'text-red-800'}`}>
                                {reworkAlarm.type === 'high_rework_alarm' ? 'CRITICAL: Task Assignment Frozen' : 'High Rework Detected'}
                              </h3>
                              <p className="text-sm text-red-700">{reworkAlarm.message || "Rework percentage > 15%. Action required."}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setShowReworkActionDialog(true)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            Request Peer Review
                          </Button>
                        </div>
                      )}

                      {/* Action Taken Status Banner */}
                      {reworkAlarm && reworkAlarm.status === 'APPEALED' && (
                        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-6 w-6 text-green-600" />
                            <div>
                              <h3 className="font-bold text-green-800">Status: Action Taken</h3>
                              <p className="text-sm text-green-700">
                                Escalation paused. Peer review requested. Escalation is on hold while changes are reviewed.
                              </p>
                              {reworkAlarm.appealed_at && (
                                <p className="text-xs text-green-600 mt-1">
                                  Timestamp: {new Date(reworkAlarm.appealed_at).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          {reworkAlarm.sender_name && (
                            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 whitespace-nowrap">
                              Escalation Paused
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Rework Info Content - Card-based list */}
                      {(() => {
                        const reworkEntries = myTimesheets.filter(t => t.work_type === 'rework');
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {reworkEntries.length === 0 ? (
                              <div className="col-span-full">
                                <Card className="bg-white/60 backdrop-blur-xl border-dashed border-2 border-slate-200">
                                  <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
                                    <CheckCircle className="h-10 w-10 mb-2 text-green-500" />
                                    <p className="text-lg font-medium">No rework recorded</p>
                                    <p className="text-sm">Great job! You have no rework entries.</p>
                                  </CardContent>
                                </Card>
                              </div>
                            ) : (
                              reworkEntries.map(entry => (
                                <Card key={entry.id} className="bg-white hover:shadow-md transition-shadow border-l-4 border-l-amber-500">
                                  <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                        Rework
                                      </Badge>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">
                                          {new Date(entry.date).toLocaleDateString()}
                                        </span>
                                        {/* Card Action Menu */}
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-100">
                                              <MoreVertical className="h-4 w-4 text-slate-400" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => {
                                              setSelectedReworkEntry(entry);
                                              setShowReworkActionDialog(true);
                                            }}>
                                              <Users className="w-4 h-4 mr-2" />
                                              Request Peer Review
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                    <h3 className="font-semibold text-slate-900 mb-1 line-clamp-1">{entry.task_title || 'Untitled Task'}</h3>
                                    <p className="text-xs text-slate-600 mb-3 flex items-center gap-1">
                                      <Briefcase className="h-3 w-3" />
                                      {entry.project_name || 'Unknown Project'}
                                    </p>

                                    <div className="bg-slate-50 p-3 rounded-md mb-3 text-sm text-slate-700 italic border border-slate-100">
                                      "{entry.remark || 'No remark provided'}"
                                    </div>

                                    <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-100">
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {entry.hours}h {entry.minutes}m
                                      </span>
                                      <Badge variant="secondary" className="text-[10px]">
                                        {entry.status}
                                      </Badge>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))
                            )}
                          </div>
                        );
                      })()}
                    </TabsContent>
                  )}

                  {/* Rework Reviews Tab (Incoming Requests) */}
                  {currentUser?.custom_role === 'viewer' && (
                    <TabsContent value="rework-reviews" className="space-y-4 mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {peerReviewRequests.length === 0 ? (
                          <div className="col-span-full">
                            <Card className="bg-white/60 backdrop-blur-xl border-dashed border-2 border-slate-200">
                              <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
                                <CheckCircle className="h-10 w-10 mb-2 text-slate-300" />
                                <p className="text-lg font-medium">No pending reviews</p>
                                <p className="text-sm">You have no incoming peer review requests.</p>
                              </CardContent>
                            </Card>
                          </div>
                        ) : (
                          peerReviewRequests.map(req => (
                            <Card key={req.id} className="bg-white hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    Review Request
                                  </Badge>
                                  <span className="text-xs text-slate-500">
                                    {new Date(req.createdAt || Date.now()).toLocaleDateString()}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 mb-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${req.sender_name}`} />
                                    <AvatarFallback>{req.sender_name?.substring(0, 2)}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <h4 className="font-semibold text-sm text-slate-900">{req.sender_name}</h4>
                                    <p className="text-xs text-slate-500">Requested a review</p>
                                  </div>
                                </div>

                                <div className="bg-slate-50 p-3 rounded-md mb-4 text-sm text-slate-700 border border-slate-100">
                                  <p className="font-medium text-xs text-slate-500 mb-1 uppercase">Message:</p>
                                  "{req.message?.split('Focus: ')[1] || req.message}"
                                </div>

                                <Button
                                  size="sm"
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => completeReviewMutation.mutate(req.id)}
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Mark as Done
                                </Button>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </TabsContent>
                  )}

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
      <SubmitTimesheetsDialog
        open={showSubmitDialog}
        onClose={() => setShowSubmitDialog(false)}
        draftEntries={myDraftEntries}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['my-timesheets'] });
          queryClient.invalidateQueries({ queryKey: ['all-timesheets'] });
        }}
      />

      {/* Goal Reached AlertDialog */}
      <AlertDialog open={showGoalReachedDialog} onOpenChange={setShowGoalReachedDialog}>
        <AlertDialogContent className="bg-white/95 backdrop-blur-xl border-slate-200">
          <AlertDialogHeader className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-2 -top-2 h-8 w-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 z-50"
              onClick={() => setShowGoalReachedDialog(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl font-bold text-slate-900">
              Daily Goal Reached!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-600">
              Great work! You have logged {Math.floor(todayDraftMinutes / 60)}h {todayDraftMinutes % 60}m for today.
              Would you like to finalize and submit your timesheets now, or continue adding more entries?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <AlertDialogCancel
              onClick={() => {
                setShowForm(true);
                setEditingEntry(null);
                toast.info("Logging additional entry...");
              }}
              className="mt-0 sm:mt-0 flex-1 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Add More
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkSubmitMutation.mutate(todayDraftEntries.map(e => e.id));
                setShowGoalReachedDialog(false);
              }}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md"
            >
              Submit All for Today
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rework Action Dialog */}
      {(reworkAlarm || selectedReworkEntry) && (
        <ReworkActionDialog
          open={showReworkActionDialog}
          onClose={() => {
            setShowReworkActionDialog(false);
            setSelectedReworkEntry(null);
          }}
          notification={reworkAlarm}
          reworkEntry={selectedReworkEntry}
          currentUser={currentUser}
          users={users}
          initialAction="peerReview"
          onActionComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['rework-alarm'] });
            if (reworkAlarm) {
              toast.success("Rework alert resolved.");
            } else {
              toast.success("Peer review requested.");
            }
          }}
        />
      )}
    </div>
  );
}

