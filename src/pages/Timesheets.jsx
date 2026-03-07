
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
  TrendingUp,
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
  Send,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  XCircle,
  Trash2,
  ChevronLeft,
  ChevronRight
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
import ReworkActionDialog from "../components/timesheets/ReworkActionDialog";
import TaskDetailDialog from "../components/tasks/TaskDetailDialog";
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

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [activeTab, setActiveTab] = useState(
    tabParam === "approvals" ||
      tabParam === "team-timesheets" ||
      tabParam === "reports" ||
      tabParam === "alarms" ||
      tabParam === "rework-info" ||
      tabParam === "rework-reviews"
      ? tabParam : "my-timesheets"
  );

  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showReworkActionDialog, setShowReworkActionDialog] = useState(false);
  const [showGoalReachedDialog, setShowGoalReachedDialog] = useState(false);
  const [selectedReworkEntry, setSelectedReworkEntry] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showTaskDetailDialog, setShowTaskDetailDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const queryClient = useQueryClient();
  const lastAutoOpenedId = React.useRef(null);

  // Listen for custom event from empty states
  React.useEffect(() => {
    const handleOpenForm = () => {
      setEditingEntry(null);
      setShowForm(true);
    };
    window.addEventListener('open-timesheet-form', handleOpenForm);
    return () => window.removeEventListener('open-timesheet-form', handleOpenForm);
  }, []);

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

  // Fetch ALL timesheets (unfiltered/unpaginated) JUST FOR STATS AND DRAFTS
  const { data: allStatsTimesheets = [], isLoading: allLoading } = useQuery({
    queryKey: ['all-stats-timesheets', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Timesheet.filter(
        { tenant_id: effectiveTenantId },
        '-date'
      );
    },
    enabled: !!currentUser && (isAdmin || isPM),
    refetchInterval: 5000,
  });

  const { data: myStatsTimesheets = [], isLoading: myLoading } = useQuery({
    queryKey: ['my-stats-timesheets', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      return groonabackend.entities.Timesheet.filter(
        { user_email: currentUser.email },
        '-date'
      );
    },
    enabled: !!currentUser,
    refetchInterval: 5000,
  });

  // Switch stats source based on role
  const statsTimesheets = (isAdmin || isPM) ? allStatsTimesheets : myStatsTimesheets;

  // Serverside Paginated Main Timesheets Fetch
  const { data: paginatedData = { results: [], totalCount: 0 }, isLoading: isTimesheetsLoading } = useQuery({
    queryKey: ['paginated-timesheets', effectiveTenantId, currentPage, userFilter, statusFilter, projectFilter, dateRangeFilter, isAdmin, isPM, currentUser?.email],
    queryFn: async () => {
      const filters = {};
      if (isAdmin || isPM) {
        if (!effectiveTenantId) return { results: [], totalCount: 0 };
        filters.tenant_id = effectiveTenantId;
      } else {
        if (!currentUser?.email) return { results: [], totalCount: 0 };
        filters.user_email = currentUser.email;
      }

      // Apply User Filter
      if (userFilter !== 'all') {
        filters.user_email = userFilter;
      }
      // Apply Status Filter
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }
      // Apply Project Filter
      if (projectFilter !== 'all') {
        filters.project_id = projectFilter;
      }
      // Apply Date Filter
      if (dateRangeFilter !== 'all') {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (dateRangeFilter === 'today') {
          filters.date = todayStr;
        } else if (dateRangeFilter === 'week') {
          const past = new Date(); past.setDate(past.getDate() - 7);
          const pastStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
          filters.date = { $gte: pastStr };
        } else if (dateRangeFilter === 'month') {
          const past = new Date(); past.setDate(past.getDate() - 30);
          const pastStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
          filters.date = { $gte: pastStr };
        }
      }

      const res = await groonabackend.entities.Timesheet.filter(
        filters,
        '-date',
        currentPage,
        itemsPerPage
      );

      if (Array.isArray(res)) return { results: res, totalCount: res.length };
      return res;
    },
    enabled: !!currentUser && !!effectiveTenantId,
    refetchInterval: 5000,
  });

  const isLoading = isTimesheetsLoading;
  const targetTimesheets = paginatedData.results || [];
  const targetTotalCount = paginatedData.totalCount || 0;
  const totalPages = Math.ceil(targetTotalCount / itemsPerPage);

  // Filter handlers
  const handleFilterChange = (setter) => (val) => {
    setter(val);
    setCurrentPage(1);
  };


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
          const entryDateStr = newEntry.date?.substring(0, 10);
          const isLate = entryDateStr && entryDateStr < todayStr;

          // 1. Notify the Submitter (User)
          await groonabackend.entities.Notification.create({
            tenant_id: effectiveTenantId,
            recipient_email: currentUser.email,
            type: isLate ? 'late_timesheet_submission' : 'timesheet_submission',
            title: isLate ? 'Late Timesheet Submission' : 'Timesheet Submitted',
            message: isLate
              ? `You have submitted a late timesheet for task: ${newEntry.task_title}`
              : `You have successfully submitted a timesheet for task: ${newEntry.task_title}`,
            entity_type: 'timesheet',
            entity_id: newEntry.id,
            project_id: newEntry.project_id,
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

        // Send email asynchronously after timesheet is successfully logged/submitted
        setTimeout(async () => {
          try {
            const entryDateStr = newEntry.date?.substring(0, 10);
            const isLate = entryDateStr && entryDateStr < todayStr;

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
                entryCount: 1,
                isLate: isLate
              }
            });
          } catch (emailError) {
            console.error('[Timesheets] Failed to send submission email:', emailError);
          }
        }, 0);
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

      // === NOTIFICATION & EMAIL LOGIC (Added to match SubmitDialog) ===
      try {
        // Fetch full timesheet details to get project info
        const timesheets = await Promise.all(timesheetIds.map(id => groonabackend.entities.Timesheet.get(id)));
        const firstTimesheet = timesheets[0];
        const user = currentUser;

        // Notify Approvers
        const uniqueProjectIds = [...new Set(timesheets.map(e => {
          return e.project_id && typeof e.project_id === 'object' ? e.project_id._id || e.project_id.id : e.project_id;
        }).filter(Boolean))];

        for (const pid of uniqueProjectIds) {
          const pmRoles = await groonabackend.entities.ProjectUserRole.filter({ project_id: pid, role: 'project_manager' });
          const projectList = await groonabackend.entities.Project.filter({ id: pid });
          const projectData = projectList[0];

          for (const pmRole of pmRoles) {
            await groonabackend.entities.Notification.create({
              tenant_id: effectiveTenantId,
              recipient_email: pmRole.user_email,
              type: 'timesheet_approval_needed',
              category: 'general',
              title: 'Timesheet Approval Pending',
              message: `${user.full_name} submitted timesheets for ${projectData?.name || 'project'}`,
              entity_type: 'timesheet',
              sender_name: user.full_name
            });
          }
        }

        const admins = await groonabackend.entities.User.filter({ tenant_id: effectiveTenantId, role: 'admin' });
        for (const admin of admins) {
          await groonabackend.entities.Notification.create({
            tenant_id: effectiveTenantId,
            recipient_email: admin.email,
            type: 'timesheet_approval_needed',
            category: 'general',
            title: 'Timesheet Approval Pending',
            message: `${user.full_name} submitted ${timesheetIds.length} timesheet entries`,
            entity_type: 'timesheet',
            sender_name: user.full_name
          });
        }

        // Determine if any entry is late
        const isLateBatch = timesheets.some(t => {
          const entryDateStr = t.date?.substring(0, 10);
          return entryDateStr && entryDateStr < todayStr;
        });

        // Send Email to Submitter
        await groonabackend.email.sendTemplate({
          to: user.email,
          templateType: 'timesheet_submitted',
          data: {
            memberName: user.full_name,
            memberEmail: user.email,
            taskTitle: timesheetIds.length === 1 ? (firstTimesheet?.task_title || 'N/A') : undefined,
            date: firstTimesheet?.date || new Date().toLocaleDateString('en-CA'),
            hours: firstTimesheet?.hours || 0,
            minutes: firstTimesheet?.minutes || 0,
            projectName: firstTimesheet?.project_name,
            entryCount: timesheetIds.length,
            isLate: isLateBatch
          }
        });

        // Create In-App Notification for Submitter
        await groonabackend.entities.Notification.create({
          tenant_id: effectiveTenantId,
          recipient_email: user.email,
          type: isLateBatch ? 'late_timesheet_submission' : 'timesheet_submission',
          category: 'general',
          title: isLateBatch ? 'Late Timesheet Submission' : 'Timesheet Submitted',
          message: isLateBatch
            ? `You have submitted ${timesheetIds.length} late timesheet entr${timesheetIds.length === 1 ? 'y' : 'ies'}.`
            : `You have successfully submitted ${timesheetIds.length} timesheet entr${timesheetIds.length === 1 ? 'y' : 'ies'}.`,
          entity_type: 'timesheet',
          sender_name: 'System'
        });

      } catch (err) {
        console.error('[Timesheets] Bulk submit notification error:', err);
        // Don't fail the mutation if only notifications fail
      }
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

    // Clear search params to prevent the useEffect from re-triggering the modal
    const params = new URLSearchParams(searchParams);
    params.delete('editId');
    params.delete('openReworkModal');
    setSearchParams(params);
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
  const draftTimesheets = statsTimesheets.filter(t => t.status === 'draft');
  const draftCount = draftTimesheets.length;
  // Count both pending states as "Submitted" for the user stats
  const submittedCount = statsTimesheets.filter(t => t.status === 'pending_pm' || t.status === 'pending_admin' || t.status === 'submitted').length;
  const approvedCount = statsTimesheets.filter(t => t.status === 'approved').length;

  const totalHours = statsTimesheets
    .filter(t => t.status === 'approved')
    .reduce((sum, t) => sum + (t.total_minutes || 0), 0) / 60;

  const billableHours = statsTimesheets
    .filter(t => t.status === 'approved' && t.is_billable)
    .reduce((sum, t) => sum + (t.total_minutes || 0), 0) / 60;

  const nonBillableHours = statsTimesheets
    .filter(t => t.status === 'approved' && !t.is_billable)
    .reduce((sum, t) => sum + (t.total_minutes || 0), 0) / 60;

  // Calculate Pending Approvals with strict role logic
  const pendingApprovals = useMemo(() => {
    // 1. Project Managers (Priority check: strictly PM role, even if they are admin)
    if (currentUser?.custom_role === 'project_manager') {
      return allStatsTimesheets.filter(t =>
        (t.status === 'pending_pm' || t.status === 'submitted') &&
        t.user_email !== currentUser.email &&
        !allPMEmails.includes(t.user_email)
      ).length;
    }

    // 2. Owner/Admin sees 'pending_admin'
    if (currentUser?.custom_role === 'owner' || currentUser?.role === 'admin' || currentUser?.is_super_admin) {
      return allStatsTimesheets.filter(t => t.status === 'pending_admin' || t.status === 'submitted').length;
    }

    return 0;
  }, [allStatsTimesheets, currentUser, pmData, allPMEmails, isAdmin]);

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

  const openReworkModalParam = searchParams.get('openReworkModal');
  const editIdParam = searchParams.get('editId');

  React.useEffect(() => {
    if (openReworkModalParam === 'true' && activeTab === 'rework-info' && reworkAlarm) {
      setShowReworkActionDialog(true);
    }
  }, [openReworkModalParam, activeTab, reworkAlarm]);

  // --- AUTOMATED EDIT TRIGGER (From Rejection Deep Linking) ---
  React.useEffect(() => {
    // Only trigger if we have an editIdParam AND it's different from what we last handled
    // This prevents the modal from re-opening after the user closes it (which clears editingEntry)
    if (editIdParam && targetTimesheets.length > 0 && lastAutoOpenedId.current !== editIdParam) {
      const entryToEdit = targetTimesheets.find(t => String(t.id || t._id) === String(editIdParam));
      if (entryToEdit) {
        setEditingEntry(entryToEdit);
        setShowForm(true);
        lastAutoOpenedId.current = editIdParam;
      }
    }

    // Reset the tracker if the URL parameter is cleared.
    // This allows the user to re-trigger the same entry if they navigate away and click it again.
    if (!editIdParam) {
      lastAutoOpenedId.current = null;
    }
  }, [editIdParam, targetTimesheets]);

  // Fetch INCOMING Peer Review Requests (New Schema)
  const { data: peerReviewRequests = [], refetch: refetchPeerReviews } = useQuery({
    queryKey: ['peer-review-requests', currentUser?.email],
    queryFn: async () => {
      const reqs = await groonabackend.entities.PeerReviewRequest.filter({
        reviewer_email: currentUser.email
      });
      return reqs || [];
    },
    enabled: !!currentUser?.email && currentUser?.custom_role === 'viewer',
    staleTime: 5000
  });

  // Fetch OUTGOING Peer Review Requests (Requests I sent)
  const { data: sentPeerReviewRequests = [] } = useQuery({
    queryKey: ['sent-peer-review-requests', currentUser?.email],
    queryFn: async () => {
      const reqs = await groonabackend.entities.PeerReviewRequest.filter({
        requester_email: currentUser.email
      });
      return reqs || [];
    },
    enabled: !!currentUser?.email && currentUser?.custom_role === 'viewer',
    staleTime: 5000
  });

  // Handle Update Peer Review Status
  const updateReviewMutation = useMutation({
    mutationFn: async ({ requestId, status }) => {
      // 1. Get request details first
      const req = await groonabackend.entities.PeerReviewRequest.get(requestId);

      // 2. Update status
      await groonabackend.entities.PeerReviewRequest.update(requestId, {
        status,
        ...(status === 'COMPLETED' ? { completed_at: new Date().toISOString() } : {})
      });

      // 3. Notify the requester
      if (req && req.requester_email) {
        await groonabackend.entities.Notification.create({
          tenant_id: effectiveTenantId,
          recipient_email: req.requester_email,
          type: status === 'COMPLETED' ? 'rework_review_accepted' : 'rework_review_declined',
          category: 'general',
          title: status === 'COMPLETED' ? 'Peer Review Accepted' : 'Peer Review Declined',
          message: `${currentUser.full_name} has ${status === 'COMPLETED' ? 'accepted' : 'declined'} your peer review request for ${req.task_title || 'task'}.`,
          entity_type: 'peer_review_request',
          entity_id: requestId,
          sender_name: currentUser.full_name
        });
      }

      // 4. Auto-assign the reviewer to the task
      if (status === 'COMPLETED' && req && req.task_id) {
        try {
          const taskData = await groonabackend.entities.Task.get(req.task_id);
          if (taskData) {
            const currentAssignees = Array.isArray(taskData.assigned_to)
              ? taskData.assigned_to
              : (taskData.assigned_to ? [taskData.assigned_to] : []);

            if (!currentAssignees.includes(currentUser.email)) {
              await groonabackend.entities.Task.update(req.task_id, {
                assigned_to: [...currentAssignees, currentUser.email]
              });
            }
          }
        } catch (e) {
          console.warn("Auto-assignment failed:", e);
        }
      }
    },
    onSuccess: (_, variables) => {
      toast.success(variables.status === 'COMPLETED' ? "Review accepted!" : "Review declined");
      refetchPeerReviews();
    },
    onError: (error) => {
      console.error("Failed to update review status:", error);
      toast.error("Action failed");
    }
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (requestId) => {
      await groonabackend.entities.PeerReviewRequest.delete(requestId);
    },
    onSuccess: () => {
      toast.success("Review deleted");
      refetchPeerReviews();
      queryClient.invalidateQueries({ queryKey: ['sent-peer-review-requests', currentUser?.email] });
    },
    onError: (error) => {
      console.error("Failed to delete review:", error);
      toast.error("Action failed");
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

  const myDraftEntries = myStatsTimesheets.filter(t => t.status === 'draft');
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
    statsTimesheets.forEach(t => {
      if (t.project_id && t.project_name) {
        projects.set(t.project_id, t.project_name);
      }
    });
    return Array.from(projects.entries());
  }, [statsTimesheets]);

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
    <div className="flex flex-col bg-white w-full relative min-h-screen">
      <div className="max-w-[1800px] mx-auto w-full flex flex-col relative flex-1 pb-10">
        {/* Sticky Header Section */}
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-transparent pb-0 pt-8 transition-all">
          <div className="px-8 md:px-12 pt-0 pb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h1 className="text-[32px] md:text-[40px] font-black text-slate-900 tracking-tight leading-none mb-2">Timesheets</h1>
                <p className="text-[13px] font-semibold text-slate-500 tracking-wide">Track your time and manage work hours</p>
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
              )}
            </div>

            {/* Stats Cards */}
            <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-4 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full items-stretch shrink-0">
              {(() => {
                const isRestrictedStats = currentUser?.custom_role === 'viewer' || currentUser?.custom_role === 'project_manager';
                const myTotalHoursVal = myStatsTimesheets
                  .filter(t => t.status === 'approved')
                  .reduce((sum, t) => sum + (t.total_minutes || 0), 0) / 60;

                const myApprovedCountVal = myStatsTimesheets.filter(t => t.status === 'approved').length;
                const mySubmittedCountVal = myStatsTimesheets.filter(t => t.status === 'pending_pm' || t.status === 'pending_admin' || t.status === 'submitted').length;
                const myDraftCountVal = myStatsTimesheets.filter(t => t.status === 'draft').length;

                return (
                  <>
                    <Card className="bg-white border border-slate-100 rounded-[16px] xl:rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex-shrink-0 w-full md:w-auto transition-transform hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] relative overflow-hidden">
                      <CardContent className="p-3.5 xl:p-4 2xl:p-5 h-full flex flex-col justify-between relative z-10 w-full min-w-[130px]">
                        <div className="flex items-start justify-between w-full mb-3 2xl:mb-4">
                          <p className="text-[12px] xl:text-[13px] font-bold text-[#0F172A] leading-tight pt-0.5 pr-2">
                            {isRestrictedStats ? "My Total Hours" : "Total Hours"}
                          </p>
                          <div className="h-6 w-6 2xl:h-7 2xl:w-7 rounded-[6px] 2xl:rounded-[8px] border border-slate-100 bg-white flex items-center justify-center shrink-0 shadow-sm">
                            <TrendingUp className="h-3 w-3 2xl:h-3.5 2xl:w-3.5 text-[#3B82F6]" strokeWidth={2.5} />
                          </div>
                        </div>
                        <div className="mt-auto">
                          <p className="text-2xl xl:text-3xl 2xl:text-[34px] font-black text-[#0F172A] tracking-tight leading-none mb-1.5 2xl:mb-2">
                            {isRestrictedStats ? myTotalHoursVal.toFixed(2) : totalHours.toFixed(2)}<span className="text-[14px] 2xl:text-[18px] font-bold text-slate-400 ml-0.5 tracking-normal">h</span>
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 2xl:mt-1.5">
                            <div className="h-[3px] w-5 rounded-full bg-[#3B82F6]"></div>
                            <div className="h-[3px] w-1.5 rounded-full bg-[#3B82F6]/20"></div>
                          </div>
                        </div>
                      </CardContent>
                      <TrendingUp className="absolute -bottom-2 -right-1 text-[#3B82F6]/[0.03] w-16 h-16 2xl:w-20 2xl:h-20 z-0 -rotate-12" strokeWidth={4} />
                    </Card>

                    {!isRestrictedStats && (
                      <>
                        <Card className="bg-white border border-slate-100 rounded-[16px] xl:rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex-shrink-0 w-full md:w-auto transition-transform hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] relative overflow-hidden">
                          <CardContent className="p-3.5 xl:p-4 2xl:p-5 h-full flex flex-col justify-between relative z-10 w-full min-w-[130px]">
                            <div className="flex items-start justify-between w-full mb-3 2xl:mb-4">
                              <p className="text-[12px] xl:text-[13px] font-bold text-[#0F172A] leading-tight pt-0.5 pr-2">
                                Billable Hours
                              </p>
                              <div className="h-6 w-6 2xl:h-7 2xl:w-7 rounded-[6px] 2xl:rounded-[8px] border border-slate-100 bg-white flex items-center justify-center shrink-0 shadow-sm">
                                <CheckCircle className="h-3 w-3 2xl:h-3.5 2xl:w-3.5 text-[#2ECC71]" strokeWidth={2.5} />
                              </div>
                            </div>
                            <div className="mt-auto">
                              <p className="text-2xl xl:text-3xl 2xl:text-[34px] font-black text-[#0F172A] tracking-tight leading-none mb-1.5 2xl:mb-2">
                                {billableHours.toFixed(2)}<span className="text-[14px] 2xl:text-[18px] font-bold text-slate-400 ml-0.5 tracking-normal">h</span>
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 2xl:mt-1.5">
                                <div className="h-[3px] w-5 rounded-full bg-[#2ECC71]"></div>
                                <div className="h-[3px] w-1.5 rounded-full bg-[#2ECC71]/20"></div>
                              </div>
                            </div>
                          </CardContent>
                          <CheckCircle className="absolute -bottom-3 -right-2 text-[#2ECC71]/[0.03] w-16 h-16 2xl:w-24 2xl:h-24 z-0" strokeWidth={4} />
                        </Card>

                        <Card className="bg-white border border-slate-100 rounded-[16px] xl:rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex-shrink-0 w-full md:w-auto transition-transform hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] relative overflow-hidden">
                          <CardContent className="p-3.5 xl:p-4 2xl:p-5 h-full flex flex-col justify-between relative z-10 w-full min-w-[130px]">
                            <div className="flex items-start justify-between w-full mb-3 2xl:mb-4">
                              <p className="text-[12px] xl:text-[13px] font-bold text-[#0F172A] leading-tight pt-0.5 pr-2">
                                Non-Billable
                              </p>
                              <div className="h-6 w-6 2xl:h-7 2xl:w-7 rounded-[6px] 2xl:rounded-[8px] border border-slate-100 bg-white flex items-center justify-center shrink-0 shadow-sm">
                                <Clock className="h-3 w-3 2xl:h-3.5 2xl:w-3.5 text-[#9B51E0]" strokeWidth={2.5} />
                              </div>
                            </div>
                            <div className="mt-auto">
                              <p className="text-2xl xl:text-3xl 2xl:text-[34px] font-black text-[#0F172A] tracking-tight leading-none mb-1.5 2xl:mb-2">
                                {nonBillableHours.toFixed(2)}<span className="text-[14px] 2xl:text-[18px] font-bold text-slate-400 ml-0.5 tracking-normal">h</span>
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 2xl:mt-1.5">
                                <div className="h-[3px] w-5 rounded-full bg-[#9B51E0]"></div>
                                <div className="h-[3px] w-1.5 rounded-full bg-[#9B51E0]/20"></div>
                              </div>
                            </div>
                          </CardContent>
                          <Clock className="absolute -bottom-3 -right-2 text-[#9B51E0]/[0.03] w-16 h-16 2xl:w-24 2xl:h-24 z-0" strokeWidth={4} />
                        </Card>
                      </>
                    )}
                    <Card className="bg-white border border-slate-100 rounded-[16px] xl:rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex-shrink-0 w-full md:w-auto transition-transform hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] relative overflow-hidden">
                      <CardContent className="p-3.5 xl:p-4 2xl:p-5 h-full flex flex-col justify-between relative z-10 w-full min-w-[130px]">
                        <div className="flex items-start justify-between w-full mb-3 2xl:mb-4">
                          <p className="text-[12px] xl:text-[13px] font-bold text-[#0F172A] leading-tight pt-0.5 pr-2">
                            {isRestrictedStats ? "My Approved" : "Approved"}
                          </p>
                          <div className="h-6 w-6 2xl:h-7 2xl:w-7 rounded-[6px] 2xl:rounded-[8px] border border-slate-100 bg-white flex items-center justify-center shrink-0 shadow-sm">
                            <CheckCircle className="h-3 w-3 2xl:h-3.5 2xl:w-3.5 text-[#2ECC71]" strokeWidth={2.5} />
                          </div>
                        </div>
                        <div className="mt-auto">
                          <p className="text-2xl xl:text-3xl 2xl:text-[34px] font-black text-[#0F172A] tracking-tight leading-none mb-1.5 2xl:mb-2">
                            {isRestrictedStats ? myApprovedCountVal : approvedCount}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 2xl:mt-1.5">
                            <div className="h-[3px] w-5 rounded-full bg-[#2ECC71]"></div>
                            <div className="h-[3px] w-1.5 rounded-full bg-[#2ECC71]/20"></div>
                          </div>
                        </div>
                      </CardContent>
                      <CheckCircle className="absolute -bottom-3 -right-2 text-[#2ECC71]/[0.03] w-16 h-16 2xl:w-24 2xl:h-24 z-0" strokeWidth={4} />
                    </Card>

                    <Card className="bg-white border border-slate-100 rounded-[16px] xl:rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex-shrink-0 w-full md:w-auto transition-transform hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] relative overflow-hidden">
                      <CardContent className="p-3.5 xl:p-4 2xl:p-5 h-full flex flex-col justify-between relative z-10 w-full min-w-[130px]">
                        <div className="flex items-start justify-between w-full mb-3 2xl:mb-4">
                          <p className="text-[12px] xl:text-[13px] font-bold text-[#0F172A] leading-tight pt-0.5 pr-2">
                            {isRestrictedStats ? "My Submitted" : "Submitted"}
                          </p>
                          <div className="h-6 w-6 2xl:h-7 2xl:w-7 rounded-[6px] 2xl:rounded-[8px] border border-slate-100 bg-white flex items-center justify-center shrink-0 shadow-sm">
                            <AlertCircle className="h-3 w-3 2xl:h-3.5 2xl:w-3.5 text-[#F39C12]" strokeWidth={2.5} />
                          </div>
                        </div>
                        <div className="mt-auto">
                          <p className="text-2xl xl:text-3xl 2xl:text-[34px] font-black text-[#0F172A] tracking-tight leading-none mb-1.5 2xl:mb-2">
                            {isRestrictedStats ? mySubmittedCountVal : submittedCount}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 2xl:mt-1.5">
                            <div className="h-[3px] w-5 rounded-full bg-[#F39C12]"></div>
                            <div className="h-[3px] w-1.5 rounded-full bg-[#F39C12]/20"></div>
                          </div>
                        </div>
                      </CardContent>
                      <AlertCircle className="absolute -bottom-3 -right-2 text-[#F39C12]/[0.03] w-16 h-16 2xl:w-24 2xl:h-24 z-0 -rotate-12" strokeWidth={4} />
                    </Card>

                    <Card className="bg-white border border-slate-100 rounded-[16px] xl:rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex-shrink-0 w-full md:w-auto transition-transform hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] relative overflow-hidden">
                      <CardContent className="p-3.5 xl:p-4 2xl:p-5 h-full flex flex-col justify-between relative z-10 w-full min-w-[130px]">
                        <div className="flex items-start justify-between w-full mb-3 2xl:mb-4">
                          <p className="text-[12px] xl:text-[13px] font-bold text-[#0F172A] leading-tight pt-0.5 pr-2">
                            {isRestrictedStats ? "My Drafts" : "Drafts"}
                          </p>
                          <div className="h-6 w-6 2xl:h-7 2xl:w-7 rounded-[6px] 2xl:rounded-[8px] border border-slate-100 bg-white flex items-center justify-center shrink-0 shadow-sm">
                            <FileText className="h-3 w-3 2xl:h-3.5 2xl:w-3.5 text-[#475569]" strokeWidth={2.5} />
                          </div>
                        </div>
                        <div className="mt-auto">
                          <p className="text-2xl xl:text-3xl 2xl:text-[34px] font-black text-[#0F172A] tracking-tight leading-none mb-1.5 2xl:mb-2">
                            {isRestrictedStats ? myDraftCountVal : draftCount}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 2xl:mt-1.5">
                            <div className="h-[3px] w-5 rounded-full bg-[#475569]"></div>
                            <div className="h-[3px] w-1.5 rounded-full bg-[#475569]/20"></div>
                          </div>
                        </div>
                      </CardContent>
                      <FileText className="absolute -bottom-3 -right-2 text-[#475569]/[0.03] w-16 h-16 2xl:w-24 2xl:h-24 z-0 -rotate-12" strokeWidth={4} />
                    </Card>
                  </>
                );
              })()}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="px-8 md:px-12 pt-6 pb-2 border-t border-slate-100 mt-2">
              <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 xl:gap-6">
                <TabsList className="bg-slate-50/50 border border-slate-200/60 rounded-full w-full xl:w-auto max-w-[100vw] overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-nowrap justify-start items-center h-auto p-1 lg:p-1 gap-1 shadow-sm shrink-0">
                  <TabsTrigger value="my-timesheets" className="whitespace-nowrap shrink-0 text-[11px] uppercase tracking-widest font-bold text-slate-500 data-[state=active]:text-slate-900 rounded-full data-[state=active]:bg-transparent data-[state=active]:border-[1.5px] data-[state=active]:border-slate-800 data-[state=active]:shadow-none px-3.5 py-1.5 hover:text-slate-700 transition-all border-[1.5px] border-transparent">
                    {isAdmin || isPM ? "ALL TIMESHEETS" : "MY TIMESHEETS"}
                  </TabsTrigger>
                  <TabsTrigger value="drafts" className="gap-2 whitespace-nowrap shrink-0 flex items-center text-[11px] uppercase tracking-widest font-bold text-slate-500 data-[state=active]:text-slate-900 rounded-full data-[state=active]:bg-transparent data-[state=active]:border-[1.5px] data-[state=active]:border-slate-800 data-[state=active]:shadow-none px-3.5 py-1.5 hover:text-slate-700 transition-all border-[1.5px] border-transparent">
                    DRAFTS
                    {myDraftCount > 0 && (
                      <Badge className="p-0 bg-slate-500 text-white min-w-[0.875rem] h-3.5 px-1 text-[9px] shadow-none rounded-full flex items-center justify-center leading-none">
                        {myDraftCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  {currentUser?.custom_role === 'viewer' && (
                    <>
                      <TabsTrigger value="rework-info" className="whitespace-nowrap shrink-0 text-[11px] uppercase tracking-widest font-bold text-slate-500 data-[state=active]:text-slate-900 rounded-full data-[state=active]:bg-transparent data-[state=active]:border-[1.5px] data-[state=active]:border-slate-800 data-[state=active]:shadow-none px-3.5 py-1.5 hover:text-slate-700 transition-all border-[1.5px] border-transparent">
                        REWORK INFO
                      </TabsTrigger>
                      <TabsTrigger value="rework-reviews" className="gap-2 whitespace-nowrap shrink-0 flex items-center text-[11px] uppercase tracking-widest font-bold text-slate-500 data-[state=active]:text-slate-900 rounded-full data-[state=active]:bg-transparent data-[state=active]:border-[1.5px] data-[state=active]:border-slate-800 data-[state=active]:shadow-none px-3.5 py-1.5 hover:text-slate-700 transition-all border-[1.5px] border-transparent">
                        REWORK REVIEWS
                        {peerReviewRequests.length > 0 && (
                          <Badge className="p-0 bg-[#F39C12] text-white min-w-[0.875rem] h-3.5 px-1 text-[9px] shadow-none rounded-full flex items-center justify-center leading-none">
                            {peerReviewRequests.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </>
                  )}
                  {(isAdmin || isPM) && (
                    <>
                      <TabsTrigger value="approvals" className="gap-2 whitespace-nowrap shrink-0 flex items-center text-[11px] uppercase tracking-widest font-bold text-slate-500 data-[state=active]:text-slate-900 rounded-full data-[state=active]:bg-transparent data-[state=active]:border-[1.5px] data-[state=active]:border-slate-800 data-[state=active]:shadow-none px-3.5 py-1.5 hover:text-slate-700 transition-all border-[1.5px] border-transparent">
                        APPROVALS
                        {pendingApprovals > 0 && (
                          <Badge className="p-0 bg-[#F39C12] text-white min-w-[0.875rem] h-3.5 px-1 text-[9px] shadow-none rounded-full flex items-center justify-center leading-none">
                            {pendingApprovals}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="alarms" className="gap-2 whitespace-nowrap shrink-0 flex items-center text-[11px] uppercase tracking-widest font-bold text-slate-500 data-[state=active]:text-slate-900 rounded-full data-[state=active]:bg-transparent data-[state=active]:border-[1.5px] data-[state=active]:border-slate-800 data-[state=active]:shadow-none px-3.5 py-1.5 hover:text-slate-700 transition-all border-[1.5px] border-transparent">
                        ALARMS
                        {appealedAlarmsCount > 0 && (
                          <Badge className="p-0 bg-[#E74C3C] text-white min-w-[0.875rem] h-3.5 px-1 text-[9px] shadow-none rounded-full flex items-center justify-center leading-none">
                            {appealedAlarmsCount}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </>
                  )}
                  {isAdmin && (
                    <>
                      <TabsTrigger value="team-timesheets" className="whitespace-nowrap shrink-0 text-[11px] uppercase tracking-widest font-bold text-slate-500 data-[state=active]:text-slate-900 rounded-full data-[state=active]:bg-transparent data-[state=active]:border-[1.5px] data-[state=active]:border-slate-800 data-[state=active]:shadow-none px-3.5 py-1.5 hover:text-slate-700 transition-all border-[1.5px] border-transparent">
                        TEAM OVERVIEW
                      </TabsTrigger>
                      <TabsTrigger value="reports" className="whitespace-nowrap shrink-0 text-[11px] uppercase tracking-widest font-bold text-slate-500 data-[state=active]:text-slate-900 rounded-full data-[state=active]:bg-transparent data-[state=active]:border-[1.5px] data-[state=active]:border-slate-800 data-[state=active]:shadow-none px-3.5 py-1.5 hover:text-slate-700 transition-all border-[1.5px] border-transparent">
                        REPORTS
                      </TabsTrigger>
                    </>
                  )}
                </TabsList>

                {activeTab === "my-timesheets" && (
                  <div className="flex flex-wrap items-center gap-1.5 xl:gap-2 w-full xl:w-auto justify-start xl:justify-end xl:ml-auto">
                    <div className="flex items-center gap-1.5 flex-shrink-0 mr-1">
                      <Filter className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Filters:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(isAdmin || isPM) && (
                        <Select value={userFilter} onValueChange={setUserFilter}>
                          <SelectTrigger className="h-8 w-[130px] text-[12px] bg-white border-slate-200 font-bold text-slate-700 rounded-[8px] shadow-sm hover:bg-slate-50 transition-colors focus:ring-0 focus:ring-offset-0">
                            <SelectValue placeholder="All Users" />
                          </SelectTrigger>
                          <SelectContent className="rounded-[10px] shadow-lg border-slate-200">
                            <SelectItem value="all" className="font-semibold text-[12px] rounded-md mx-1 my-0.5">All Users</SelectItem>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.email} className="rounded-md mx-1 my-0.5">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={u.profile_image_url} />
                                    <AvatarFallback className="text-[9px] bg-slate-100 font-bold text-slate-600">
                                      {u.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="truncate text-slate-700 font-semibold text-[12px]">{u.full_name || u.email}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-8 w-[120px] text-[12px] bg-white border-slate-200 font-bold text-slate-700 rounded-[8px] shadow-sm hover:bg-slate-50 transition-colors focus:ring-0 focus:ring-offset-0">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-[10px] shadow-lg border-slate-200 font-semibold text-[12px]">
                          <SelectItem value="all" className="rounded-md mx-1 my-0.5">All Status</SelectItem>
                          <SelectItem value="draft" className="rounded-md mx-1 my-0.5">Draft</SelectItem>
                          <SelectItem value="submitted" className="rounded-md mx-1 my-0.5">Submitted</SelectItem>
                          <SelectItem value="pending_pm" className="rounded-md mx-1 my-0.5">Pending PM</SelectItem>
                          <SelectItem value="pending_admin" className="rounded-md mx-1 my-0.5">Pending Admin</SelectItem>
                          <SelectItem value="approved" className="rounded-md mx-1 my-0.5">Approved</SelectItem>
                          <SelectItem value="rejected" className="rounded-md mx-1 my-0.5">Rejected</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={projectFilter} onValueChange={setProjectFilter}>
                        <SelectTrigger className="h-8 w-[130px] text-[12px] bg-white border-slate-200 font-bold text-slate-700 rounded-[8px] shadow-sm hover:bg-slate-50 transition-colors focus:ring-0 focus:ring-offset-0">
                          <SelectValue placeholder="Project" />
                        </SelectTrigger>
                        <SelectContent className="rounded-[10px] shadow-lg border-slate-200 font-semibold text-[12px]">
                          <SelectItem value="all" className="rounded-md mx-1 my-0.5">All Projects</SelectItem>
                          {uniqueProjects.map(([id, name]) => (
                            <SelectItem key={id} value={id} className="rounded-md mx-1 my-0.5">{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                        <SelectTrigger className="h-8 w-[120px] text-[12px] bg-white border-slate-200 font-bold text-slate-700 rounded-[8px] shadow-sm hover:bg-slate-50 transition-colors focus:ring-0 focus:ring-offset-0">
                          <SelectValue placeholder="Date Range" />
                        </SelectTrigger>
                        <SelectContent className="rounded-[10px] shadow-lg border-slate-200 font-semibold text-[12px]">
                          <SelectItem value="all" className="rounded-md mx-1 my-0.5">All Time</SelectItem>
                          <SelectItem value="today" className="rounded-md mx-1 my-0.5">Today</SelectItem>
                          <SelectItem value="week" className="rounded-md mx-1 my-0.5">Last 7 Days</SelectItem>
                          <SelectItem value="month" className="rounded-md mx-1 my-0.5">Last 30 Days</SelectItem>
                        </SelectContent>
                      </Select>

                      {hasActiveFilters && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearFilters}
                          className="h-8 px-2.5 text-[12px] font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-[8px] transition-colors"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 md:px-12 pb-8 md:pb-12 bg-slate-50">
              <TabsContent value="my-timesheets" className="space-y-4 mt-6 outline-none min-h-[500px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <TimesheetList
                    timesheets={filteredTimesheets.filter(t => t.status !== 'draft')}
                    currentUser={currentUser}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    users={users}
                    showActions={true}
                    canEditLocked={isAdmin}
                    groupByDate={!(isAdmin || isPM)}
                    groupByEmployee={isAdmin || isPM}
                    highlightedId={editIdParam}
                    effectiveTenantId={effectiveTenantId}
                  />
                )}

                {/* Pagination Controls */}
                {!isLoading && totalPages > 1 && (
                  <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="gap-2 px-4 h-9 font-bold text-slate-600 border-slate-200 shadow-none rounded-lg hover:bg-slate-50"
                    >
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }).map((_, i) => {
                        const pageNum = i + 1;
                        if (
                          pageNum === 1 ||
                          pageNum === totalPages ||
                          (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                        ) {
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "secondary" : "ghost"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className={`h-9 w-9 font-bold rounded-lg ${currentPage === pageNum ? 'bg-slate-100 text-slate-900 shadow-none' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                              {pageNum}
                            </Button>
                          );
                        } else if (
                          pageNum === currentPage - 2 ||
                          pageNum === currentPage + 2
                        ) {
                          return <span key={pageNum} className="px-2 text-slate-300">...</span>;
                        }
                        return null;
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="gap-2 px-4 h-9 font-bold text-slate-600 border-slate-200 shadow-none rounded-lg hover:bg-slate-50"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="drafts" className="space-y-6 mt-4 outline-none">
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
                  highlightedId={editIdParam}
                  effectiveTenantId={effectiveTenantId}
                />
              </TabsContent>

              {currentUser?.custom_role === 'viewer' && (
                <>
                  <TabsContent value="rework-info" className="space-y-4 mt-4 outline-none">
                    {reworkAlarm && reworkAlarm.status === 'OPEN' && (
                      <div className={`border-l-4 p-4 rounded-md shadow-sm flex items-center justify-between mb-4 ${reworkAlarm.type === 'high_rework_alarm' ? 'bg-red-100 border-red-600' : 'bg-red-50 border-red-500'}`}>
                        <div className="flex items-center gap-3">
                          <ShieldAlert className={`h-6 w-6 ${reworkAlarm.type === 'high_rework_alarm' ? 'text-red-700 animate-pulse' : 'text-red-600'}`} />
                          <div>
                            <h3 className={`font-bold ${reworkAlarm.type === 'high_rework_alarm' ? 'text-red-900' : 'text-red-800'}`}>
                              {reworkAlarm.type === 'high_rework_alarm' ? 'CRITICAL: Task Assignment Frozen' : 'High Rework Detected'}
                            </h3>
                            <p className="text-sm text-red-700">{reworkAlarm.message || "Rework percentage > 15%. Action required."}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="destructive" onClick={() => setShowReworkActionDialog(true)} className="bg-red-600 hover:bg-red-700 text-white">
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
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                          Escalation Paused
                        </Badge>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {myStatsTimesheets.filter(t => t.work_type === 'rework').length === 0 ? (
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
                        myStatsTimesheets.filter(t => t.work_type === 'rework').map(entry => {
                          const assocRequest = sentPeerReviewRequests.find(r => r.task_id === entry.task_id);
                          return (
                            <Card key={entry.id} className="bg-white hover:shadow-md transition-shadow border-l-4 border-l-amber-500">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                      Rework
                                    </Badge>
                                    {assocRequest && (
                                      <Badge
                                        variant="secondary"
                                        className={`text-[10px] uppercase font-bold ${assocRequest.status === 'COMPLETED'
                                          ? 'bg-green-100 text-green-700 border-green-200'
                                          : assocRequest.status === 'DECLINED'
                                            ? 'bg-red-100 text-red-700 border-red-200'
                                            : 'bg-blue-100 text-blue-700 border-blue-200'
                                          }`}
                                      >
                                        {assocRequest.status === 'COMPLETED' ? 'Review Accepted' : assocRequest.status === 'DECLINED' ? 'Review Declined' : 'Review Pending'}
                                      </Badge>
                                    )}
                                  </div>
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
                                        {assocRequest && (
                                          <DropdownMenuItem
                                            className="text-red-600"
                                            onClick={() => deleteReviewMutation.mutate(assocRequest.id)}
                                          >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Delete Review Request
                                          </DropdownMenuItem>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                                <h3
                                  className={`font-semibold text-slate-900 mb-1 line-clamp-1 ${assocRequest?.status === 'COMPLETED' ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''
                                    }`}
                                  onClick={() => {
                                    if (assocRequest?.status === 'COMPLETED') {
                                      setSelectedTaskId(entry.task_id);
                                      setShowTaskDetailDialog(true);
                                    }
                                  }}
                                >
                                  {entry.task_title || 'Untitled Task'}
                                </h3>
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
                          );
                        })
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="rework-reviews" className="space-y-4 mt-4 outline-none">
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
                          <Card key={req.id} className="bg-white hover:shadow-md transition-shadow border-t-4 border-t-blue-500 overflow-hidden">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] uppercase font-bold tracking-tight">
                                    Review Request
                                  </Badge>
                                  {req.status !== 'PENDING' && (
                                    <Badge
                                      variant="secondary"
                                      className={`text-[10px] uppercase font-bold ${req.status === 'COMPLETED'
                                        ? 'bg-green-100 text-green-700 border-green-200'
                                        : 'bg-red-100 text-red-700 border-red-200'
                                        }`}
                                    >
                                      {req.status === 'COMPLETED' ? 'Accepted' : 'Declined'}
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                  onClick={() => deleteReviewMutation.mutate(req.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="flex items-center gap-3 mb-4">
                                <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${req.requester_name}`} />
                                  <AvatarFallback>{req.requester_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <h4 className="font-bold text-sm text-slate-900 truncate">{req.requester_name}</h4>
                                  <p className="text-xs text-slate-500">Requested a review</p>
                                </div>
                              </div>

                              <div className="space-y-3 mb-4">
                                <h3
                                  className={`font-bold text-slate-800 text-sm leading-snug line-clamp-2 ${req.status === 'COMPLETED' ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''
                                    }`}
                                  onClick={() => {
                                    if (req.status === 'COMPLETED') {
                                      setSelectedTaskId(req.task_id);
                                      setShowTaskDetailDialog(true);
                                    }
                                  }}
                                >
                                  {req.task_title || 'Untitled Task'}
                                </h3>
                                <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-600 border border-slate-100/50 italic">
                                  "{req.message?.split('Focus: ')[1] || req.message || 'No specific instructions provided.'}"
                                </div>
                              </div>

                              {req.status === 'PENDING' && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold"
                                    onClick={() => updateReviewMutation.mutate({ requestId: req.id, status: 'DECLINED' })}
                                    disabled={updateReviewMutation.isPending}
                                  >
                                    <XCircle className="w-3.5 h-3.5 mr-1.5" />
                                    Decline
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                    onClick={() => updateReviewMutation.mutate({ requestId: req.id, status: 'COMPLETED' })}
                                    disabled={updateReviewMutation.isPending}
                                  >
                                    <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                                    Accept
                                  </Button>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </TabsContent>
                </>
              )}

              {(isAdmin || isPM) && (
                <>
                  <TabsContent value="approvals" className="mt-4 outline-none">
                    <ApprovalDashboard currentUser={currentUser} users={users} />
                  </TabsContent>
                  <TabsContent value="alarms" className="mt-4 outline-none">
                    <AlarmsTab currentUser={currentUser} users={users} />
                  </TabsContent>
                </>
              )}

              {isAdmin && (
                <>
                  <TabsContent value="team-timesheets" className="mt-4 outline-none">
                    <AdminTimesheetDashboard currentUser={currentUser} effectiveTenantId={effectiveTenantId} allTimesheets={allStatsTimesheets} loading={allLoading} />
                  </TabsContent>
                  <TabsContent value="reports" className="mt-4 outline-none">
                    <TimesheetReportGenerator currentUser={currentUser} effectiveTenantId={effectiveTenantId} users={users} allTimesheets={allStatsTimesheets} />
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </div>

        {/* Edit Form Modal  */}
        <AlertDialog
          open={showForm}
          onOpenChange={(open) => {
            if (!open) handleCancel();
            else setShowForm(true);
          }}
        >
          <AlertDialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto overflow-x-hidden p-0 border-none bg-transparent">
            <div className="bg-white rounded-xl shadow-2xl p-6 relative">
              <Button variant="ghost" size="icon" className="absolute right-4 top-4" onClick={handleCancel}><X className="h-4 w-4" /></Button>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">{editingEntry ? 'Edit Timesheet' : 'Log Time'}</h2>
              </div>
              <TimesheetEntryForm
                currentUser={currentUser}
                effectiveTenantId={effectiveTenantId}
                onSubmit={(data) => saveTimesheetMutation.mutate(data)}
                onCancel={handleCancel}
                initialData={editingEntry}
                loading={saveTimesheetMutation.isPending}
              />
            </div>
          </AlertDialogContent>
        </AlertDialog>

        {/* Other Dialogs  */}
        <SubmitTimesheetsDialog
          open={showSubmitDialog}
          onClose={() => setShowSubmitDialog(false)}
          draftEntries={myDraftEntries}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['my-timesheets'] });
            queryClient.invalidateQueries({ queryKey: ['all-timesheets'] });
          }}
        />

        <AlertDialog open={showGoalReachedDialog} onOpenChange={setShowGoalReachedDialog}>
          <AlertDialogContent className="bg-white/95 backdrop-blur-xl border-slate-200">
            <AlertDialogHeader className="relative">
              <Button variant="ghost" size="icon" className="absolute -right-2 -top-2 h-8 w-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 z-50" onClick={() => setShowGoalReachedDialog(false)}><X className="h-4 w-4" /></Button>
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4"><CheckCircle className="h-6 w-6 text-green-600" /></div>
              <AlertDialogTitle className="text-center text-xl font-bold text-slate-900">Daily Goal Reached!</AlertDialogTitle>
              <AlertDialogDescription className="text-center text-slate-600">Great work! You have logged {Math.floor(todayDraftMinutes / 60)}h {todayDraftMinutes % 60}m for today. Would you like to finalize and submit now?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
              <AlertDialogCancel onClick={() => { setShowForm(true); setEditingEntry(null); }} className="mt-0 sm:mt-0 flex-1 border-slate-200 text-slate-600 hover:bg-slate-50">Add More</AlertDialogCancel>
              <AlertDialogAction onClick={() => { bulkSubmitMutation.mutate(todayDraftEntries.map(e => e.id)); setShowGoalReachedDialog(false); }} className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white">Submit All</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


        {(reworkAlarm || selectedReworkEntry) && (
          <ReworkActionDialog
            open={showReworkActionDialog}
            onClose={() => { setShowReworkActionDialog(false); setSelectedReworkEntry(null); }}
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

        <TaskDetailDialog
          open={showTaskDetailDialog}
          onClose={() => { setShowTaskDetailDialog(false); setSelectedTaskId(null); }}
          taskId={selectedTaskId}
        />
      </div>
    </div >
  );
}
