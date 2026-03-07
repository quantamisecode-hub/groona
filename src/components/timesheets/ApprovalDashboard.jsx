import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Clock, MapPin, Calendar, User, Briefcase, History, CalendarCheck, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { format, formatDistanceToNow, isValid } from "date-fns";
import { useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ApprovalDashboard({ currentUser, users = [] }) {
  const queryClient = useQueryClient();
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [comment, setComment] = useState("");
  const [editHours, setEditHours] = useState(0);
  const [editMinutes, setEditMinutes] = useState(0);
  const [editIsBillable, setEditIsBillable] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    if (selectedEntry) {
      setEditHours(selectedEntry.hours || 0);
      setEditMinutes(selectedEntry.minutes || 0);
      setEditIsBillable(selectedEntry.is_billable || false);
    }
  }, [selectedEntry]);

  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id
    ? currentUser.active_tenant_id
    : currentUser?.tenant_id;

  const SafeDateDisplay = ({ date, format = "locale", addSuffix = false }) => {
    if (!date) return null;
    const dateObj = new Date(date);
    if (!isValid(dateObj)) return <span>Invalid Date</span>;
    if (format === "distance") {
      return <span>{formatDistanceToNow(dateObj, { addSuffix })}</span>;
    }
    return <span>{dateObj.toLocaleDateString()}</span>;
  };

  const { data: paginatedData = { results: [], totalCount: 0 }, isLoading } = useQuery({
    queryKey: ['pending-timesheets', effectiveTenantId, currentUser?.email, currentPage, itemsPerPage],
    queryFn: async () => {
      if (!effectiveTenantId) return { results: [], totalCount: 0 };

      let filters = { tenant_id: effectiveTenantId };

      // 1. Owners: See 'pending_admin' (PM-approved/rejected) or 'submitted' (Legacy/Direct)
      if (currentUser?.role === 'admin' && currentUser?.custom_role === 'owner') {
        filters.status = { $in: ['pending_admin', 'submitted'] };
      }
      // 2. Project Managers: See 'pending_pm' (Team member submitted)
      else if (currentUser?.custom_role === 'project_manager') {
        filters.status = { $in: ['pending_pm', 'submitted'] };
      }
      // Default (Super Admin or other admins who might need to see everything fallback)
      else if (currentUser?.is_super_admin) {
        filters.status = { $in: ['pending_admin', 'pending_pm', 'submitted'] };
      } else {
        return { results: [], totalCount: 0 };
      }

      const res = await groonabackend.entities.Timesheet.filter(
        filters,
        '-submitted_at',
        currentPage,
        itemsPerPage
      );

      let data = Array.isArray(res) ? { results: res, totalCount: res.length } : res;

      // Project Managers specific client-side filter to hide their own pending entries
      if (currentUser?.custom_role === 'project_manager' && data.results) {
        const originalLength = data.results.length;
        data.results = data.results.filter(t => t.user_email !== currentUser.email);
        data.totalCount -= (originalLength - data.results.length);
      }

      return data;
    },
    enabled: !!currentUser && !!effectiveTenantId,
  });

  const pendingTimesheets = paginatedData.results || [];
  const totalCount = paginatedData.totalCount || 0;

  // Fetch metadata (Stories, Epics) for rich display
  const projectIds = [...new Set(pendingTimesheets.map(t => t.project_id))];

  const { data: stories = [] } = useQuery({
    queryKey: ['stories-metadata', projectIds.join(',')],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      // Fetch stories for all relevant projects
      const results = [];
      for (const pid of projectIds) {
        const pStories = await groonabackend.entities.Story.filter({ project_id: pid });
        results.push(...pStories);
      }
      return results;
    },
    enabled: projectIds.length > 0
  });

  const { data: epics = [] } = useQuery({
    queryKey: ['epics-metadata', projectIds.join(',')],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const results = [];
      for (const pid of projectIds) {
        const pEpics = await groonabackend.entities.Epic.filter({ project_id: pid });
        results.push(...pEpics);
      }
      return results;
    },
    enabled: projectIds.length > 0
  });

  const approveMutation = useMutation({
    mutationFn: async ({ timesheetId, status, comment }) => {
      // Get timesheet - try from pending list first, then fetch if not found
      let timesheet = pendingTimesheets.find(t => t.id === timesheetId);

      // If not found in pending list, fetch it directly
      if (!timesheet) {
        try {
          const fetched = await groonabackend.entities.Timesheet.filter({ id: timesheetId });
          timesheet = fetched[0];
        } catch (error) {
          console.error('[ApprovalDashboard] Failed to fetch timesheet:', error);
        }
      }

      if (!timesheet) {
        throw new Error('Timesheet not found');
      }

      // Determine next status based on who is approving/rejecting
      let nextStatus = status;
      let notificationTitle = 'Timesheet Status Update';
      let notificationMessage = `Your timesheet status has been updated to ${status}`;

      if (status === 'approved') {
        // If PM is approving, it goes to 'pending_admin'
        if (currentUser.custom_role === 'project_manager') {
          nextStatus = 'pending_admin';
          notificationTitle = 'Timesheet PM Approved';
          notificationMessage = `Your timesheet has been approved by ${currentUser.full_name} and is now pending Admin approval.`;
        } else if (currentUser.custom_role === 'owner' || currentUser.is_super_admin) {
          // Owner/Admin approving -> Final 'approved'
          nextStatus = 'approved';
          notificationTitle = 'Timesheet Approved';
          notificationMessage = `Your timesheet has been fully approved by ${currentUser.full_name}.`;
        }
      } else if (status === 'rejected') {
        // === CHANGED: PM Rejection goes to Owner for Final Review ===
        if (currentUser.custom_role === 'project_manager') {
          nextStatus = 'pending_admin'; // Forward to Owner
          notificationTitle = 'Timesheet Reviewed by PM';
          notificationMessage = `Your timesheet was reviewed by ${currentUser.full_name} (Recommendation: Reject) and passed to Owner for final decision. reason: ${comment}`;
        } else {
          // Owner Rejection -> Final 'rejected'
          notificationTitle = 'Timesheet Rejected';
          notificationMessage = `Your timesheet has been rejected by ${currentUser.full_name}. Reason: ${comment}`;
        }
      }

      // Update timesheet status
      await groonabackend.entities.Timesheet.update(timesheetId, {
        status: nextStatus,
        approved_by: currentUser.full_name,
        approved_at: new Date().toISOString(),
        is_locked: nextStatus === 'approved', // Only lock on final approval
        rejection_reason: status === 'rejected' ? comment : undefined
      });

      // Fetch the LATEST timesheet data to ensure email reflects any admin edits (hours/minutes)
      const [freshTimesheet] = await groonabackend.entities.Timesheet.filter({ id: timesheetId });

      // Fallback to local if fetch fails (unlikely)
      const finalTimesheet = freshTimesheet || timesheet;

      try {
        await groonabackend.entities.TimesheetApproval.create({
          tenant_id: effectiveTenantId,
          timesheet_id: timesheetId,
          approver_email: currentUser.email,
          approver_name: currentUser.full_name,
          approver_role: currentUser.role === 'admin' || currentUser.is_super_admin ? 'admin' : 'project_manager',
          status: nextStatus,
          comment,
          acted_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Approval record creation skipped:", e);
      }

      // Backend sync for Project Billing
      if (status === 'approved' && finalTimesheet?.is_billable) {
        try {
          await groonabackend.functions.invoke('updateProjectBillable', { timesheet_id: timesheetId });
        } catch (error) {
          console.error('[ApprovalDashboard] Failed to update project billable:', error);
        }
      }

      // Send notifications (in-app and email) - separate try-catch for each
      // In-app notification
      try {
        await groonabackend.entities.Notification.create({
          tenant_id: effectiveTenantId,
          recipient_email: finalTimesheet.user_email,
          type: 'timesheet_status', // Use generic status type for clock icon
          title: notificationTitle,
          message: notificationMessage,
          entity_type: 'timesheet',
          entity_id: timesheetId,
          link: `/Timesheets?tab=my-timesheets&editId=${timesheetId}`,
          sender_name: currentUser.full_name
        });

        // 2. Notify Owners/Admins if status moved to 'pending_admin'
        if (nextStatus === 'pending_admin') {
          // Fetch all potential approvers (Owners and Admins)
          const allUsers = await groonabackend.entities.User.list();
          const approvers = allUsers.filter(u =>
            u.tenant_id === effectiveTenantId && u.custom_role === 'owner'
          );

          await Promise.all(approvers.map(approver =>
            groonabackend.entities.Notification.create({
              tenant_id: effectiveTenantId,
              recipient_email: approver.email,
              type: 'timesheet_approval_needed',
              title: 'Pending Admin Approval',
              message: `There is a pending admin timesheet for task: ${finalTimesheet.task_title} from ${finalTimesheet.user_name}`,
              entity_type: 'timesheet',
              entity_id: timesheetId,
              sender_name: currentUser.full_name
            })
          ));
        }
      } catch (notifError) {
        console.error('[ApprovalDashboard] Failed to send in-app notification:', notifError);
        // Continue even if in-app notification fails
      }

      // Email notification using template - send asynchronously after approval/rejection
      // ONLY SEND EMAIL IF APPROVER IS OWNER (Final Decision) OR PM REJECTS (Recommendation)
      if (currentUser.custom_role === 'owner' || currentUser.is_super_admin || (currentUser.custom_role === 'project_manager' && status === 'rejected')) {
        const emailData = {
          memberName: finalTimesheet.user_name || finalTimesheet.user_email,
          memberEmail: finalTimesheet.user_email,
          taskTitle: finalTimesheet.task_title || 'N/A',
          date: finalTimesheet.date,
          hours: finalTimesheet.hours || 0,
          minutes: finalTimesheet.minutes || 0,
          approvedBy: status === 'approved' ? currentUser.full_name : undefined,
          rejectedBy: status === 'rejected' ? currentUser.full_name : undefined,
          comment: comment,
          reason: status === 'rejected' ? (comment || 'No reason provided') : undefined
        };
        const templateType = status === 'approved' ? 'timesheet_approved' : 'timesheet_rejected';

        // Fire and forget - send email asynchronously
        setTimeout(async () => {
          try {
            await groonabackend.email.sendTemplate({
              to: timesheet.user_email,
              templateType,
              data: {
                ...emailData,
                description: notificationMessage
              }
            });
            console.log('[ApprovalDashboard] Email notification sent successfully');

            // === NEW: Notify PM(s) about final decision ===
            const finalProjectId = finalTimesheet.project_id?.id || finalTimesheet.project_id?._id || finalTimesheet.project_id;
            const pmRoles = await groonabackend.entities.ProjectUserRole.filter({
              project_id: finalProjectId,
              role: 'project_manager'
            });
            const pmEmails = [...new Set(pmRoles.map(r => r.user_email))].filter(e => e !== currentUser.email && e !== finalTimesheet.user_email);

            await Promise.all(pmEmails.map(email =>
              groonabackend.entities.Notification.create({
                tenant_id: effectiveTenantId,
                recipient_email: email,
                type: 'timesheet_status',
                title: status === 'approved' ? 'Timesheet Final Approved' : 'Timesheet Final Rejected',
                message: `Final decision for ${finalTimesheet.user_name}'s timesheet: ${status}. Action by Admin: ${currentUser.full_name}`,
                entity_type: 'timesheet',
                entity_id: timesheetId,
                sender_name: currentUser.full_name
              })
            ));

          } catch (emailError) {
            console.error('[ApprovalDashboard] Failed to send final notifications:', emailError);
            // failure does not affect approval/rejection
          }
        }, 0);
      }

      return { timesheet, status, comment };
    },
    onSuccess: (_, variables) => {
      // === OPTIMISTIC UPDATE ===
      // Immediately remove from pending list
      queryClient.setQueryData(['pending-timesheets', effectiveTenantId, currentUser?.email], (old) => {
        return Array.isArray(old) ? old.filter(t => t.id !== variables.timesheetId) : [];
      });

      // === CRITICAL SYNC ===
      // Invalidate ALL lists to ensure Team Overview and Reports update instantly
      queryClient.invalidateQueries({ queryKey: ['pending-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['team-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['my-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['bi-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['report-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['project-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['task-notifications'] }); // Update notifications immediately

      toast.success(variables.status === 'approved' ? 'Timesheet approved' : 'Timesheet rejected');
      setSelectedEntry(null);
      setComment("");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`Failed to process timesheet`);
    }
  });

  const handleApprove = (timesheet) => {
    approveMutation.mutate({
      timesheetId: timesheet.id,
      status: 'approved',
      comment: comment || 'Approved'
    });
  };

  const handleReject = (timesheet) => {
    if (!comment.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    approveMutation.mutate({
      timesheetId: timesheet.id,
      status: 'rejected',
      comment
    });
  };

  const TimesheetCard = ({ timesheet }) => {
    const submissionDate = timesheet.submitted_at || timesheet.updated_date || timesheet.created_date;
    const story = stories.find(s => s.id === timesheet.story_id);
    const epic = story ? epics.find(e => e.id === story.epic_id) : null;

    return (
      <Card
        className={`bg-white border border-slate-200/60 rounded-[12px] shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${selectedEntry?.id === timesheet.id ? 'ring-2 ring-blue-500 border-transparent' : ''}`}
        onClick={() => setSelectedEntry(timesheet)}
      >
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col space-y-3">
            {/* Top Row: Title, Hours, Status */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center flex-wrap gap-2.5 flex-1">
                <h4 className="font-bold text-[13px] text-slate-900 uppercase tracking-wide">
                  {timesheet.task_title || 'Untitled Task'}
                  <span className="text-[10px] font-normal text-slate-400 normal-case tracking-normal ml-1.5">(Task)</span>
                </h4>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0 min-w-fit">
                <Badge variant="outline" className="flex items-center gap-1 bg-transparent px-2 py-0 h-6 rounded-full text-[11px] font-medium whitespace-nowrap shadow-none border-slate-200">
                  <Clock className="h-3 w-3" />
                  {timesheet.time_spent || `${timesheet.hours || 0}h ${timesheet.minutes || 0}m`}
                </Badge>
                <Badge variant="outline" className={`text-[10px] py-0 px-2 h-5 rounded-full border-0 whitespace-nowrap shadow-none font-bold tracking-wide uppercase ${timesheet.status === 'pending_pm' ? 'bg-blue-50 text-blue-700' :
                  timesheet.status === 'pending_admin' ? (timesheet.rejection_reason ? 'bg-red-50 text-red-700' : 'bg-purple-50 text-purple-700') :
                    'bg-slate-50 text-slate-600'
                  }`}>
                  {timesheet.status === 'pending_admin' && timesheet.rejection_reason ? 'PM REJECTED' :
                    timesheet.status === 'pending_pm' ? 'Pending PM' :
                      timesheet.status.replace('pending_', 'Pending ')}
                </Badge>
              </div>
            </div>

            {/* User and metadata */}
            <div className="flex items-center flex-wrap gap-2.5">
              {(() => {
                const user = users.find(u => u.email === timesheet.user_email);
                return (
                  <div className="flex items-center gap-1.5 px-2 py-0 h-6 bg-transparent rounded-full border border-slate-200 shadow-sm">
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={user?.profile_image_url} />
                      <AvatarFallback className="text-[8px] bg-slate-100 text-slate-600 font-medium border border-slate-200">
                        {timesheet.user_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[11px] font-bold text-slate-700">{timesheet.user_name}</span>
                  </div>
                );
              })()}

              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="font-medium text-slate-400">Sprint:</span>
                <span className="font-bold text-slate-700">{timesheet.sprint_name || 'N/A'}</span>
              </div>

              {story && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 border-l border-slate-200 pl-2.5">
                  <span className="font-medium text-slate-400">Story:</span>
                  <span className="font-bold text-slate-700">{story.title}</span>
                </div>
              )}
            </div>

            {/* Edited Badge */}
            {timesheet.last_modified_by_name && (
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="bg-amber-50/50 text-amber-600 border-amber-200 text-[10px] py-0 h-5 rounded-full font-medium gap-1 shadow-none">
                  <History className="h-2.5 w-2.5" />
                  Edited by {timesheet.last_modified_by_name}
                </Badge>
              </div>
            )}

            {/* Description & Remark Formatted */}
            <div className="pt-3 mt-3 border-t border-slate-100/80">
              <div className="flex items-center gap-2 text-[12px] text-slate-500 font-medium mb-1.5">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                <span>{timesheet.project_name || 'Unknown Project'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-medium">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <SafeDateDisplay date={timesheet.date} />
                </div>
                {submissionDate && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-400">Submitted <SafeDateDisplay date={submissionDate} format="distance" addSuffix={true} /></span>
                  </>
                )}
              </div>
              {timesheet.location && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-1">
                  <MapPin className="h-3 w-3 text-slate-400" />
                  <span>{timesheet.location.city || 'Location tracked'}</span>
                </div>
              )}

              {timesheet.description && (
                <p className="text-[12px] text-slate-600 leading-relaxed mt-2.5 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100/50">
                  {timesheet.description}
                </p>
              )}
              {timesheet.remark && (
                <div className="mt-2.5 p-2.5 bg-amber-50/50 border border-amber-100 rounded-lg text-[11px] text-amber-700 italic">
                  <strong className="font-semibold text-amber-800 not-italic mr-1">Remark:</strong>
                  {timesheet.remark}
                </div>
              )}

              {/* Mini Audit Section in Card */}
              <div className="mt-3 flex justify-between text-[10px] text-slate-400 font-medium tracking-wide">
                <span>Created: {timesheet.created_date ? format(new Date(timesheet.created_date), 'MMM d, HH:mm') : 'N/A'}</span>
                {timesheet.last_modified_at && (
                  <span className="text-amber-500/80">Modified: {format(new Date(timesheet.last_modified_at), 'MMM d, HH:mm')}</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return <div className="text-center py-8 text-slate-600">Loading approvals...</div>;
  }

  if (totalCount === 0) {
    return (
      <div className="space-y-4">
        <div className="mb-4">
          <h3 className="text-[15px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
            Pending Approvals
            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-none px-2 rounded-full font-bold shadow-none">
              {totalCount}
            </Badge>
          </h3>
        </div>
        <Card className="bg-white border border-slate-200/60 rounded-[12px] shadow-sm">
          <CardContent className="py-16 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 font-medium">No pending approvals</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="mb-4">
          <h3 className="text-[15px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
            Pending Approvals
            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-none px-2 rounded-full font-bold shadow-none">
              {totalCount}
            </Badge>
          </h3>
        </div>
        <div className="space-y-3">
          {pendingTimesheets.map(timesheet => (
            <TimesheetCard key={timesheet.id} timesheet={timesheet} />
          ))}
        </div>

        {totalCount > itemsPerPage && (
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="gap-2 px-4 h-9 font-bold text-slate-600 border-slate-200 shadow-none rounded-[10px] hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>

            <div className="flex items-center gap-1">
              {(() => {
                const totalPages = Math.ceil(totalCount / itemsPerPage);
                return Array.from({ length: totalPages }).map((_, i) => {
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
                        className={`h-9 w-9 font-bold rounded-[10px] ${currentPage === pageNum ? 'bg-slate-100 text-slate-900 shadow-none' : 'text-slate-500 hover:bg-slate-50'}`}
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
                });
              })()}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const totalPages = Math.ceil(totalCount / itemsPerPage);
                setCurrentPage(prev => Math.min(totalPages, prev + 1));
              }}
              disabled={currentPage === Math.ceil(totalCount / itemsPerPage) || totalCount === 0}
              className="gap-2 px-4 h-9 font-bold text-slate-600 border-slate-200 shadow-none rounded-[10px] hover:bg-slate-50"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-6">
        {selectedEntry ? (
          <Card className="bg-white border border-slate-200/60 rounded-[12px] shadow-sm">
            <CardHeader className="bg-slate-50/50 rounded-t-[12px] border-b border-slate-100/80 pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-700">Review Time Entry</CardTitle>
            </CardHeader>
            <CardContent className="p-5 md:p-6 space-y-6">
              <div className="space-y-5 pb-6 border-b border-slate-100">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Task</label>
                  <p className="text-[14px] font-bold text-slate-900 leading-snug">{selectedEntry.task_title || 'N/A'}</p>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  {(selectedEntry.sprint_name || (() => {
                    const selectedStory = stories.find(s => s.id === selectedEntry.story_id);
                    return selectedStory;
                  })()) && (
                      <>
                        {selectedEntry.sprint_name && (
                          <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Sprint</label>
                            <Badge variant="secondary" className="text-[11px] font-semibold">{selectedEntry.sprint_name}</Badge>
                          </div>
                        )}
                        {(() => {
                          const selectedStory = stories.find(s => s.id === selectedEntry.story_id);
                          if (!selectedStory) return null;
                          return (
                            <div className="col-span-2 md:col-span-1">
                              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Story</label>
                              <p className="text-[12px] font-semibold text-slate-800 line-clamp-2">{selectedStory.title}</p>
                            </div>
                          );
                        })()}
                      </>
                    )}

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">User</label>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const user = users.find(u => u.email === selectedEntry.user_email);
                        return (
                          <Avatar className="h-7 w-7 ring-2 ring-slate-100/50">
                            <AvatarImage src={user?.profile_image_url} />
                            <AvatarFallback className="text-[10px] bg-slate-50 border border-slate-200 text-slate-600 font-bold">
                              {selectedEntry.user_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        );
                      })()}
                      <div>
                        <p className="text-[13px] font-bold text-slate-900 leading-none">{selectedEntry.user_name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[120px]" title={selectedEntry.user_email}>{selectedEntry.user_email}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Date</label>
                    <p className="text-[13px] font-semibold text-slate-800 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <SafeDateDisplay date={selectedEntry.date} />
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50/80 border border-slate-100 rounded-[12px] p-4 space-y-4 shadow-sm">
                  <div>
                    <Label className="text-[12px] font-bold text-slate-800">Time Spent <span className="text-slate-400 font-normal italic ml-1">(Editable)</span></Label>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <div className="flex-1 min-w-[120px]">
                        <Label className="text-[11px] text-slate-500 font-medium mb-1.5 block">Hours</Label>
                        <Input
                          type="number"
                          min="0"
                          value={editHours}
                          onChange={(e) => setEditHours(parseInt(e.target.value) || 0)}
                          className="h-9 bg-white shadow-sm font-semibold border-slate-200"
                        />
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <Label className="text-[11px] text-slate-500 font-medium mb-1.5 block">Minutes</Label>
                        <Input
                          type="number"
                          min="0"
                          max="59"
                          value={editMinutes}
                          onChange={(e) => setEditMinutes(parseInt(e.target.value) || 0)}
                          className="h-9 bg-white shadow-sm font-semibold border-slate-200"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200/60 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-[12px] font-bold text-slate-800">Billable Time</Label>
                      <p className="text-[11px] text-slate-500 font-medium">Is this work billable to the client?</p>
                    </div>
                    <Switch
                      checked={editIsBillable}
                      onCheckedChange={setEditIsBillable}
                      className="data-[state=checked]:bg-green-500"
                    />
                  </div>
                </div>

                {/* Visual Cue for Owner if PM Rejected */}
                {selectedEntry.status === 'pending_admin' && selectedEntry.rejection_reason && (
                  <div className="p-3.5 bg-red-50/50 border border-red-200 rounded-[10px]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-[12px] font-bold text-red-800 uppercase tracking-wide">PM Recommendation: REJECT</span>
                    </div>
                    <p className="text-[13px] text-red-700 leading-relaxed">
                      <strong className="font-semibold text-red-900">Reason:</strong> {selectedEntry.rejection_reason}
                    </p>
                    <p className="text-[11px] text-red-600/80 mt-1.5 italic font-medium">
                      (You can choose to Accept (Override) or Reject (Confirm) below)
                    </p>
                  </div>
                )}

                {selectedEntry.description && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Description</label>
                    <p className="text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">{selectedEntry.description}</p>
                  </div>
                )}
                {selectedEntry.remark && (
                  <div className="p-3 bg-amber-50/50 border border-amber-200/60 rounded-lg mt-3">
                    <label className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1 block">Remark</label>
                    <p className="text-amber-900 text-[13px] leading-relaxed italic">{selectedEntry.remark}</p>
                  </div>
                )}
                {selectedEntry.location && (
                  <div className="mt-3">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Location</label>
                    <p className="text-[13px] font-medium text-slate-700 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {[
                        selectedEntry.location.city,
                        selectedEntry.location.state,
                        selectedEntry.location.pincode,
                        selectedEntry.location.country
                      ].filter(Boolean).join(', ') || 'Coordinates captured'}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <label className="text-[12px] font-bold text-slate-700">Comment <span className="text-slate-400 font-normal ml-1">(optional for approval, required for rejection)</span></label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add your feedback..."
                  rows={3}
                  disabled={approveMutation.isPending}
                  className="resize-none shadow-sm focus-visible:ring-1 border-slate-200/80 rounded-[10px] text-[13px]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={async () => {
                    // Check if values changed
                    const totalMinutes = (parseInt(editHours) * 60) + parseInt(editMinutes);
                    const hasChanged =
                      parseInt(editHours) !== (selectedEntry.hours || 0) ||
                      parseInt(editMinutes) !== (selectedEntry.minutes || 0) ||
                      editIsBillable !== selectedEntry.is_billable;

                    if (hasChanged) {
                      try {
                        await groonabackend.entities.Timesheet.update(selectedEntry.id, {
                          hours: parseInt(editHours),
                          minutes: parseInt(editMinutes),
                          total_minutes: totalMinutes,
                          is_billable: editIsBillable,
                          // Add audit note optionally
                          remark: (selectedEntry.remark ? selectedEntry.remark + '\n' : '') + `[Admin Adjusted: ${hasChanged ? 'Time/Billable status updated' : ''}]`
                        });
                        toast.success("Entry updated before approval");
                      } catch (err) {
                        console.error("Failed to update entry:", err);
                        toast.error("Failed to update entry details");
                        return;
                      }
                    }
                    approveMutation.mutate({ timesheetId: selectedEntry.id, status: 'approved', comment });
                  }}
                  disabled={approveMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold h-11 rounded-lg border-none shadow-sm transition-all"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  onClick={() => handleReject(selectedEntry)}
                  disabled={approveMutation.isPending}
                  variant="outline"
                  className="flex-1 border-red-200/60 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-300 font-bold h-11 rounded-lg transition-all"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white border border-slate-200/60 rounded-[12px] shadow-sm mt-10">
            <CardContent className="py-24 text-center">
              <Clock className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500 font-medium">Select a timesheet to review</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

