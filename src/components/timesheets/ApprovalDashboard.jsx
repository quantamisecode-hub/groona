import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Clock, MapPin, Calendar, User, Briefcase, History, CalendarCheck, AlertCircle } from "lucide-react";
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

  const { data: pendingTimesheets = [], isLoading } = useQuery({
    queryKey: ['pending-timesheets', effectiveTenantId, currentUser?.email],
    queryFn: async () => {
      if (!effectiveTenantId) return [];

      // Fetch ALL timesheets and filter in memory
      const allTimesheets = await groonabackend.entities.Timesheet.filter({
        tenant_id: effectiveTenantId
      }, '-submitted_at');

      // Helper for robust sorting (Latest first)
      const sortDesc = (list) => list.sort((a, b) => {
        const dateA = new Date(a.submitted_at || a.updated_date || a.created_date || a.date);
        const dateB = new Date(b.submitted_at || b.updated_date || b.created_date || b.date);
        return dateB - dateA;
      });

      // 1. Owners: See 'pending_admin' (PM-approved/rejected) or 'submitted' (Legacy/Direct)
      if (currentUser?.role === 'admin' && currentUser?.custom_role === 'owner') {
        return sortDesc(allTimesheets.filter(t =>
          t.status === 'pending_admin' ||
          t.status === 'submitted'
        ));
      }

      // 2. Project Managers: See 'pending_pm' (Team member submitted)
      if (currentUser?.custom_role === 'project_manager') {
        // Relaxed Rule: Show ALL 'pending_pm' timesheets regardless of project assignment
        // (User requested to see everything for now)

        return sortDesc(allTimesheets.filter(t =>
          (t.status === 'pending_pm' || t.status === 'submitted') &&
          t.user_email !== currentUser.email
        ));
      }

      // Default (Super Admin or other admins who might need to see everything fallback)
      if (currentUser?.is_super_admin) {
        return sortDesc(allTimesheets.filter(t => t.status === 'pending_admin' || t.status === 'pending_pm' || t.status === 'submitted'));
      }

      return [];
    },
    enabled: !!currentUser && !!effectiveTenantId,
  });

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
      // ONLY SEND EMAIL IF APPROVER IS OWNER (Final Decision)
      if (currentUser.custom_role === 'owner' || currentUser.is_super_admin) {
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
        className={`hover:shadow-md transition-shadow cursor-pointer ${selectedEntry?.id === timesheet.id ? 'ring-2 ring-blue-500' : ''
          }`}
        onClick={() => setSelectedEntry(timesheet)}
      >
        <CardHeader className="pb-3 px-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base leading-tight break-words pr-2">
                {timesheet.task_title || 'Untitled Task'}
                <span className="text-xs font-normal text-slate-500 ml-1">(Task)</span>
              </CardTitle>

              <div className="space-y-1 mt-2">
                {timesheet.sprint_name && (
                  <div className="text-xs text-slate-600 flex items-center gap-1">
                    <span className="font-semibold w-12 shrink-0">Sprint:</span>
                    <Badge variant="secondary" className="text-[10px] h-5 truncate max-w-[150px]">{timesheet.sprint_name}</Badge>
                  </div>
                )}
                {story && (
                  <div className="text-xs text-slate-600 flex items-center gap-1">
                    <span className="font-semibold w-12 shrink-0">Story:</span>
                    <span className="truncate">{story.title}</span>
                  </div>
                )}
                {epic && (
                  <div className="text-xs text-slate-600 flex items-center gap-1">
                    <span className="font-semibold w-12 shrink-0">Epic:</span>
                    <span className="truncate">{epic.name}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0 min-w-fit">
              <Badge variant="outline" className="flex items-center gap-1 bg-white whitespace-nowrap">
                <Clock className="h-3 w-3" />
                {timesheet.time_spent || `${timesheet.hours || 0}h ${timesheet.minutes || 0}m`}
              </Badge>

              <Badge variant="outline" className={`text-[10px] py-1 px-2 h-auto border-0 whitespace-nowrap shadow-sm ${timesheet.status === 'pending_pm' ? 'bg-blue-50 text-blue-700' :
                timesheet.status === 'pending_admin' ? (timesheet.rejection_reason ? 'bg-red-50 text-red-700 font-bold' : 'bg-purple-100 text-purple-800') :
                  'bg-slate-100 text-slate-600'
                }`}>
                {timesheet.status === 'pending_admin' && timesheet.rejection_reason ? 'PM REJECTED' :
                  timesheet.status === 'pending_pm' ? 'Pending PM' :
                    timesheet.status.replace('pending_', 'Pending ').replace('_', ' ')}
              </Badge>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            {(() => {
              const user = users.find(u => u.email === timesheet.user_email);
              return (
                <div className="flex items-center gap-2 px-2 py-0.5 bg-slate-50 rounded-full border border-slate-100">
                  <Avatar className="h-5 w-5 ring-2 ring-slate-400 ring-offset-1">
                    <AvatarImage src={user?.profile_image_url} />
                    <AvatarFallback className="text-[10px] bg-white">
                      {timesheet.user_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate font-bold text-xs text-slate-600">{timesheet.user_name}</span>
                </div>
              );
            })()}
          </div>

          {/* Edited Badge */}
          {timesheet.last_modified_by_name && (
            <div className="flex items-center gap-1 mt-1">
              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] py-0 h-4 gap-1">
                <History className="h-2.5 w-2.5" />
                Edited by {timesheet.last_modified_by_name}
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Briefcase className="h-3 w-3" />
            <span>{timesheet.project_name || 'Unknown Project'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="h-3 w-3" />
            <SafeDateDisplay date={timesheet.date} />
            {submissionDate && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                • Submitted <SafeDateDisplay date={submissionDate} format="distance" addSuffix={true} />
              </span>
            )}
          </div>
          {timesheet.location && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="h-3 w-3" />
              <span>{timesheet.location.city || 'Location tracked'}</span>
            </div>
          )}
          {timesheet.description && (
            <p className="text-sm text-slate-600 line-clamp-2 mt-2 pt-2 border-t">
              {timesheet.description}
            </p>
          )}
          {timesheet.remark && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-100 rounded text-xs text-amber-800 italic">
              <strong>Remark:</strong> {timesheet.remark}
            </div>
          )}

          {/* Mini Audit Section in Card */}
          <div className="mt-3 pt-2 border-t border-slate-50 flex justify-between text-[10px] text-slate-400">
            <span>Created: {timesheet.created_date ? format(new Date(timesheet.created_date), 'MMM d, HH:mm') : 'N/A'}</span>
            {timesheet.last_modified_at && (
              <span className="text-amber-500">Modified: {format(new Date(timesheet.last_modified_at), 'MMM d, HH:mm')}</span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return <div className="text-center py-8 text-slate-600">Loading approvals...</div>;
  }

  if (pendingTimesheets.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Pending Approvals ({pendingTimesheets.length})
        </h3>
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-600">No pending approvals</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Pending Approvals ({pendingTimesheets.length})
        </h3>
        <div className="space-y-3">
          {pendingTimesheets.map(timesheet => (
            <TimesheetCard key={timesheet.id} timesheet={timesheet} />
          ))}
        </div>
      </div>

      <div className="lg:sticky lg:top-6">
        {selectedEntry ? (
          <Card>
            <CardHeader>
              <CardTitle>Review Time Entry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 pb-4 border-b">
                <div>
                  <label className="text-sm font-medium text-slate-700">Task</label>
                  <p className="text-slate-900">{selectedEntry.task_title || 'N/A'}</p>
                </div>
                {selectedEntry.sprint_name && (
                  <div>
                    <label className="text-sm font-medium text-slate-700">Sprint</label>
                    <p className="text-slate-900"><Badge variant="secondary">{selectedEntry.sprint_name}</Badge></p>
                  </div>
                )}
                {(() => {
                  const selectedStory = stories.find(s => s.id === selectedEntry.story_id);
                  const selectedEpic = selectedStory ? epics.find(e => e.id === selectedStory.epic_id) : null;
                  return (
                    <>
                      {selectedStory && (
                        <div>
                          <label className="text-sm font-medium text-slate-700">Story</label>
                          <p className="text-slate-900">{selectedStory.title}</p>
                        </div>
                      )}
                      {selectedEpic && (
                        <div>
                          <label className="text-sm font-medium text-slate-700">Epic</label>
                          <p className="text-slate-900">{selectedEpic.name}</p>
                        </div>
                      )}
                    </>
                  );
                })()}
                <div>
                  <label className="text-sm font-medium text-slate-700">User</label>
                  <p className="text-slate-900">{selectedEntry.user_name} ({selectedEntry.user_email})</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Time Spent (Editable)</Label>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-xs text-slate-500">Hours</Label>
                      <Input
                        type="number"
                        min="0"
                        value={editHours}
                        onChange={(e) => setEditHours(parseInt(e.target.value) || 0)}
                        className="h-8"
                      />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-xs text-slate-500">Minutes</Label>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={editMinutes}
                        onChange={(e) => setEditMinutes(parseInt(e.target.value) || 0)}
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium text-slate-900">Billable Time</Label>
                    <p className="text-xs text-slate-500">Is this work billable to the client?</p>
                  </div>
                  <Switch
                    checked={editIsBillable}
                    onCheckedChange={setEditIsBillable}
                  />
                </div>

                {/* Visual Cue for Owner if PM Rejected */}
                {selectedEntry.status === 'pending_admin' && selectedEntry.rejection_reason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-bold text-red-800">PM Recommendation: REJECT</span>
                    </div>
                    <p className="text-sm text-red-700">
                      <strong>Reason:</strong> {selectedEntry.rejection_reason}
                    </p>
                    <p className="text-xs text-red-600 mt-1 italic">
                      (You can choose to Accept (Override) or Reject (Confirm) below)
                    </p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium text-slate-700">Date</Label>
                  <p className="text-slate-900 mt-1">
                    <SafeDateDisplay date={selectedEntry.date} />
                  </p>
                </div>
                {selectedEntry.description && (
                  <div>
                    <label className="text-sm font-medium text-slate-700">Description</label>
                    <p className="text-slate-900 whitespace-pre-wrap">{selectedEntry.description}</p>
                  </div>
                )}
                {selectedEntry.remark && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <label className="text-sm font-semibold text-amber-900 italic">Remark</label>
                    <p className="text-amber-800 text-sm">{selectedEntry.remark}</p>
                  </div>
                )}
                {selectedEntry.location && (
                  <div>
                    <label className="text-sm font-medium text-slate-700">Location</label>
                    <p className="text-slate-900">
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

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Comment (optional for approval, required for rejection)</label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add your feedback..."
                  rows={3}
                  disabled={approveMutation.isPending}
                />
              </div>

              <div className="flex gap-3">
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
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  onClick={() => handleReject(selectedEntry)}
                  disabled={approveMutation.isPending}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-600">Select a timesheet to review</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

