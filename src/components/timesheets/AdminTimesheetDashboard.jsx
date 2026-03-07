import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

import {
  Users,
  Search,
  XCircle,
  FileText,
  Loader2,
  Plus,
  Lock,
  Unlock
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import TimesheetReportGenerator from "./TimesheetReportGenerator";
import TimesheetEntryForm from "./TimesheetEntryForm";

export default function AdminTimesheetDashboard({
  currentUser,
  effectiveTenantId,
  allTimesheets,
  loading
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [approvingEntry, setApprovingEntry] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
  const [processingLock, setProcessingLock] = useState({ type: null, id: null });
  const queryClient = useQueryClient();

  // Fetch all users
  const { data: users = [] } = useQuery({
    queryKey: ['users', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u => u.tenant_id === effectiveTenantId);
    },
    enabled: !!effectiveTenantId,
  });

  // Approve timesheet mutation
  const approveTimesheetMutation = useMutation({
    mutationFn: async (entry) => {
      // Get the full timesheet data
      let timesheet = entry;
      if (!timesheet || !timesheet.user_email) {
        try {
          const fetched = await groonabackend.entities.Timesheet.filter({ id: entry.id });
          timesheet = fetched[0];
        } catch (error) {
          console.error('[AdminTimesheetDashboard] Failed to fetch timesheet:', error);
        }
      }

      if (!timesheet) {
        throw new Error('Timesheet not found');
      }

      // Update timesheet
      await groonabackend.entities.Timesheet.update(entry.id, {
        status: 'approved',
        approved_by: currentUser.full_name,
        approved_at: new Date().toISOString(),
        is_locked: true,
      });

      // Create approval record
      try {
        await groonabackend.entities.TimesheetApproval.create({
          tenant_id: effectiveTenantId,
          timesheet_id: entry.id,
          approver_email: currentUser.email,
          approver_name: currentUser.full_name,
          approver_role: currentUser.role === 'admin' || currentUser.is_super_admin ? 'admin' : 'project_manager',
          status: 'approved',
          comment: '',
          acted_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Approval record creation skipped:", e);
      }

      // Backend sync for Project Billing
      if (timesheet?.is_billable) {
        try {
          await groonabackend.functions.invoke('updateProjectBillable', { timesheet_id: entry.id });
        } catch (error) {
          console.error('[AdminTimesheetDashboard] Failed to update project billable:', error);
        }
      }

      // Send notifications asynchronously after approval
      const notificationData = {
        tenant_id: effectiveTenantId,
        recipient_email: timesheet.user_email,
        type: 'timesheet_status',
        title: 'Timesheet Approved',
        message: `Your timesheet for ${timesheet.task_title || 'N/A'} has been approved`,
        entity_type: 'timesheet',
        entity_id: entry.id,
        sender_name: currentUser.full_name
      };
      const emailData = {
        memberName: timesheet.user_name || timesheet.user_email,
        memberEmail: timesheet.user_email,
        taskTitle: timesheet.task_title || 'N/A',
        date: timesheet.date,
        hours: timesheet.hours || 0,
        minutes: timesheet.minutes || 0,
        approvedBy: currentUser.full_name,
        comment: ''
      };

      setTimeout(async () => {
        try {
          await groonabackend.entities.Notification.create(notificationData);
          await groonabackend.email.sendTemplate({
            to: timesheet.user_email,
            templateType: 'timesheet_approved',
            data: emailData
          });

          // Notify PM(s)
          const pmRoles = await groonabackend.entities.ProjectUserRole.filter({
            project_id: timesheet.project_id?.id || timesheet.project_id?._id || timesheet.project_id,
            role: 'project_manager'
          });
          const pmEmails = [...new Set(pmRoles.map(r => r.user_email))].filter(e => e !== currentUser.email && e !== timesheet.user_email);

          await Promise.all(pmEmails.map(email =>
            groonabackend.entities.Notification.create({
              tenant_id: effectiveTenantId,
              recipient_email: email,
              type: 'timesheet_status',
              title: 'Timesheet Final Approved',
              message: `Admin finalized ${timesheet.user_name || 'Member'}'s timesheet for ${timesheet.task_title}: Approved`,
              entity_type: 'timesheet',
              entity_id: entry.id,
              sender_name: currentUser.full_name
            })
          ));
        } catch (notifError) {
          console.error('[AdminTimesheetDashboard] Failed to send notifications:', notifError);
        }
      }, 0);

      return timesheet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-timesheets'] });
      toast.success('Timesheet approved');
      setApprovingEntry(null);
    },
    onError: (error) => {
      console.error('[AdminTimesheetDashboard] Approval error:', error);
      toast.error('Failed to approve timesheet');
    },
  });

  // Reject timesheet mutation
  const rejectTimesheetMutation = useMutation({
    mutationFn: async ({ entry, reason }) => {
      let timesheet = entry;
      if (!timesheet || !timesheet.user_email) {
        try {
          const fetched = await groonabackend.entities.Timesheet.filter({ id: entry.id });
          timesheet = fetched[0];
        } catch (error) {
          console.error('[AdminTimesheetDashboard] Failed to fetch timesheet:', error);
        }
      }

      if (!timesheet) {
        throw new Error('Timesheet not found');
      }

      await groonabackend.entities.Timesheet.update(entry.id, {
        status: 'rejected',
        approved_by: currentUser.full_name,
        approved_at: new Date().toISOString(),
        rejection_reason: reason,
      });

      try {
        await groonabackend.entities.TimesheetApproval.create({
          tenant_id: effectiveTenantId,
          timesheet_id: entry.id,
          approver_email: currentUser.email,
          approver_name: currentUser.full_name,
          approver_role: currentUser.role === 'admin' || currentUser.is_super_admin ? 'admin' : 'project_manager',
          status: 'rejected',
          comment: reason,
          acted_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Approval record creation skipped:", e);
      }

      const rejectNotificationData = {
        tenant_id: effectiveTenantId,
        recipient_email: timesheet.user_email,
        type: 'timesheet_status',
        title: 'Timesheet Rejected',
        message: `Your timesheet for ${timesheet.task_title || 'N/A'} was rejected: ${reason || 'No reason provided'}`,
        entity_type: 'timesheet',
        entity_id: entry.id,
        sender_name: currentUser.full_name
      };
      const rejectEmailData = {
        memberName: timesheet.user_name || timesheet.user_email,
        memberEmail: timesheet.user_email,
        taskTitle: timesheet.task_title || 'N/A',
        date: timesheet.date,
        hours: timesheet.hours || 0,
        minutes: timesheet.minutes || 0,
        rejectedBy: currentUser.full_name,
        comment: reason,
        reason: reason || 'No reason provided'
      };

      setTimeout(async () => {
        try {
          await groonabackend.entities.Notification.create(rejectNotificationData);
          await groonabackend.email.sendTemplate({
            to: timesheet.user_email,
            templateType: 'timesheet_rejected',
            data: rejectEmailData
          });

          const pmRoles = await groonabackend.entities.ProjectUserRole.filter({
            project_id: timesheet.project_id?.id || timesheet.project_id?._id || timesheet.project_id,
            role: 'project_manager'
          });
          const pmEmails = [...new Set(pmRoles.map(r => r.user_email))].filter(e => e !== currentUser.email && e !== timesheet.user_email);

          await Promise.all(pmEmails.map(email =>
            groonabackend.entities.Notification.create({
              tenant_id: effectiveTenantId,
              recipient_email: email,
              type: 'timesheet_status',
              title: 'Timesheet Final Rejected',
              message: `Admin finalized ${timesheet.user_name || 'Member'}'s timesheet for ${timesheet.task_title}: Rejected`,
              entity_type: 'timesheet',
              entity_id: entry.id,
              sender_name: currentUser.full_name
            })
          ));
        } catch (notifError) {
          console.error('[AdminTimesheetDashboard] Failed to send rejection notifications:', notifError);
        }
      }, 0);

      return timesheet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-timesheets'] });
      toast.success('Timesheet rejected');
      setApprovingEntry(null);
      setRejectionReason("");
    },
    onError: (error) => {
      console.error('[AdminTimesheetDashboard] Rejection error:', error);
      toast.error('Failed to reject timesheet');
    },
  });

  // Save/Update timesheet mutation
  const saveTimesheetMutation = useMutation({
    mutationFn: async (data) => {
      if (editingEntry) {
        const auditData = {
          ...data,
          last_modified_by_name: currentUser.full_name,
          last_modified_at: new Date().toISOString()
        };
        return groonabackend.entities.Timesheet.update(editingEntry.id, auditData);
      }
      return groonabackend.entities.Timesheet.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-timesheets'] });
      toast.success(editingEntry ? 'Timesheet updated!' : 'Timesheet created!');
      setShowEditForm(false);
      setEditingEntry(null);
      setSelectedUserForEdit(null);
    },
    onError: (error) => {
      console.error('Save error:', error);
      toast.error('Failed to save timesheet');
    },
  });

  // Audit Lock Mutation
  const auditLockMutation = useMutation({
    mutationFn: async ({ userIds, locked }) => {
      const response = await fetch(`${groonabackend.apiBaseUrl}/audit-lock/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userIds,
          locked,
          tenantId: effectiveTenantId
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to toggle lock');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      const status = variables.locked ? 'locked' : 'unlocked';
      toast.success(`User(s) ${status} successfully`);
    },
    onError: (error) => {
      console.error('Audit Lock error:', error);
      toast.error(`Failed: ${error.message}`);
    },
    onSettled: () => {
      setProcessingLock({ type: null, id: null });
    }
  });

  const handleToggleLock = (user, locked) => {
    setProcessingLock({ type: 'single', id: user._id || user.id });
    auditLockMutation.mutate({
      userIds: [user._id || user.id],
      locked
    });
  };

  const handleLockAll = (locked) => {
    const allUserIds = users.filter(u => u.role !== 'admin' && u.custom_role !== 'owner' && u.custom_role !== 'client').map(u => u._id || u.id);
    if (confirm(`Are you sure you want to ${locked ? 'LOCK' : 'UNLOCK'} timesheets for ALL ${allUserIds.length} members?`)) {
      setProcessingLock({ type: 'all' });
      auditLockMutation.mutate({
        userIds: allUserIds,
        locked
      });
    }
  };


  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    rejectTimesheetMutation.mutate({
      entry: approvingEntry,
      reason: rejectionReason
    });
  };

  const handleCreateForUser = (userEmail) => {
    setEditingEntry(null);
    setSelectedUserForEdit(userEmail);
    setShowEditForm(true);
  };

  // Group timesheets by user
  const timesheetsByUser = allTimesheets.reduce((acc, entry) => {
    if (!acc[entry.user_email]) {
      acc[entry.user_email] = [];
    }
    acc[entry.user_email].push(entry);
    return acc;
  }, {});

  const filteredUsers = users.filter(user => {
    const isClient = user.custom_role === 'client';
    const matchesSearch = user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (isClient) return false;

    if (currentUser?.custom_role === 'owner' && currentUser?.role === 'admin') {
      return matchesSearch;
    }

    return user.role === 'member' && matchesSearch;
  });

  const isAllLocked = filteredUsers.length > 0 && filteredUsers.every(u => u.is_timesheet_locked);

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="employees" className="w-full">
        <TabsList className="bg-slate-50 border border-slate-200/60 rounded-[12px] p-1 gap-1 inline-flex h-auto max-w-full overflow-x-auto shadow-sm">
          <TabsTrigger value="employees" className="gap-2 px-4 py-2 text-[12px] font-bold uppercase tracking-widest text-slate-500 data-[state=active]:text-slate-900 rounded-[10px] data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
            <Users className="h-3.5 w-3.5" />
            All Employees
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2 px-4 py-2 text-[12px] font-bold uppercase tracking-widest text-slate-500 data-[state=active]:text-slate-900 rounded-[10px] data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
            <FileText className="h-3.5 w-3.5" />
            Generate Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4 mt-6">
          <Card className="bg-transparent border-none shadow-none mb-2">
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 bg-white border border-slate-200/80 rounded-[10px] shadow-sm text-[13px] focus-visible:ring-1 focus-visible:ring-slate-300 font-medium transition-all"
                  />
                </div>

                <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-[10px] border border-slate-200/80 shadow-sm transition-all hover:bg-slate-50 cursor-pointer">
                  {processingLock.type === 'all' && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  )}
                  <div className="flex items-center gap-2">
                    {isAllLocked ? <Lock className="w-4 h-4 text-red-600" /> : <Unlock className="w-4 h-4 text-slate-400" />}
                    <span className={`text-[11px] font-bold tracking-widest uppercase mt-0.5 ${isAllLocked ? 'text-red-700' : 'text-slate-600'}`}>
                      {isAllLocked ? 'All Users Locked' : 'Audit Lock All'}
                    </span>
                  </div>
                  <Switch
                    checked={isAllLocked}
                    onCheckedChange={(checked) => handleLockAll(checked)}
                    className="data-[state=checked]:bg-red-500 ml-1.5 shadow-sm scale-90"
                    disabled={processingLock.type === 'all'}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.length === 0 ? (
              <div className="col-span-full text-center py-10 text-slate-500">
                No members found matching your search.
              </div>
            ) : (
              filteredUsers.map((user) => {
                const userTimesheets = timesheetsByUser[user.email] || [];
                const totalMinutes = userTimesheets
                  .filter(t => t.status === 'approved')
                  .reduce((sum, t) => sum + (t.total_minutes || 0), 0);
                const pendingCount = userTimesheets.filter(t => t.status === 'submitted').length;
                const isThisUserLoading = processingLock.type === 'single' && processingLock.id === (user._id || user.id);

                return (
                  <Card key={user.id} className="bg-white border border-slate-200/60 rounded-[12px] shadow-sm hover:shadow-md transition-all duration-200 group">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-11 w-11 ring-2 ring-slate-100/80 shadow-sm transition-transform group-hover:scale-[1.03] duration-200">
                          <AvatarImage src={user.profile_image_url} />
                          <AvatarFallback className="bg-slate-50 border border-slate-200/60 text-slate-600 font-bold text-[13px]">
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-[14px] text-slate-900 truncate leading-snug">{user.full_name}</h4>
                          <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">{user.email}</p>

                          <div className="flex flex-wrap items-center gap-2 mt-2.5">
                            <Badge variant="outline" className="bg-slate-50/80 text-slate-700 border-slate-200/80 text-[11px] py-0 px-2 h-5 rounded-full font-bold shadow-none">
                              {(totalMinutes / 60).toFixed(1)}<span className="text-slate-400 ml-0.5 font-medium">h logged</span>
                            </Badge>
                            {pendingCount > 0 && (
                              <Badge variant="outline" className="bg-amber-50/80 text-amber-600 border-amber-200 text-[10px] py-0 px-2 h-5 rounded-full font-bold shadow-none uppercase tracking-wide">
                                {pendingCount} Pending
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-100/80 space-y-3">
                        <div className="flex items-center justify-between p-2.5 rounded-[10px] bg-slate-50/80 border border-slate-200/60">
                          <div className="flex items-center gap-2">
                            {isThisUserLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                            ) : user.is_timesheet_locked ? (
                              <Lock className="w-3.5 h-3.5 text-red-500" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">
                              Audit Lock
                            </span>
                          </div>
                          <Switch
                            checked={!!user.is_timesheet_locked}
                            onCheckedChange={(checked) => handleToggleLock(user, checked)}
                            className="data-[state=checked]:bg-red-500 scale-[0.85] shadow-sm ml-auto"
                            disabled={isThisUserLoading}
                          />
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCreateForUser(user.email)}
                          className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-9 font-bold bg-transparent text-[12px] rounded-[10px] transition-all border border-transparent shadow-none"
                        >
                          <Plus className="h-4 w-4 mr-1.5" />
                          Add Timesheet
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <TimesheetReportGenerator
            currentUser={currentUser}
            effectiveTenantId={effectiveTenantId}
            users={users}
            allTimesheets={allTimesheets}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={!!approvingEntry} onOpenChange={() => {
        setApprovingEntry(null);
        setRejectionReason("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Timesheet Entry</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this timesheet entry.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setApprovingEntry(null);
                setRejectionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={rejectTimesheetMutation.isPending}
            >
              {rejectTimesheetMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditForm} onOpenChange={(open) => {
        if (!open) {
          setShowEditForm(false);
          setEditingEntry(null);
          setSelectedUserForEdit(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? 'Edit Timesheet Entry' : 'Create Timesheet Entry'}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? `Editing timesheet for ${editingEntry.user_name}`
                : `Creating new timesheet for ${users.find(u => u.email === selectedUserForEdit)?.full_name}`
              }
            </DialogDescription>
          </DialogHeader>

          <TimesheetEntryForm
            currentUser={currentUser}
            effectiveTenantId={effectiveTenantId}
            onSubmit={(data) => saveTimesheetMutation.mutate(data)}
            onCancel={() => {
              setShowEditForm(false);
              setEditingEntry(null);
              setSelectedUserForEdit(null);
            }}
            initialData={editingEntry}
            loading={saveTimesheetMutation.isPending}
            selectedUserEmail={selectedUserForEdit}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
