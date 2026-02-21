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


  const handleApprove = (entry) => {
    if (confirm('Approve this timesheet entry?')) {
      approveTimesheetMutation.mutate(entry);
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

  const handleEditTimesheet = (entry) => {
    setEditingEntry(entry);
    setSelectedUserForEdit(entry.user_email);
    setShowEditForm(true);
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
        <TabsList className="bg-white/80 backdrop-blur-xl border border-slate-200 flex flex-wrap h-auto">
          <TabsTrigger value="employees" className="gap-2 flex-1 md:flex-none">
            <Users className="h-4 w-4" />
            All Employees
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2 flex-1 md:flex-none">
            <FileText className="h-4 w-4" />
            Generate Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4 mt-6">
          <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                  {processingLock.type === 'all' && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  )}
                  <span className={`text-sm font-medium flex items-center gap-2 ${isAllLocked ? 'text-red-700' : 'text-slate-700'}`}>
                    {isAllLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4 text-slate-500" />}
                    {isAllLocked ? 'All Users Locked' : 'Audit Lock All'}
                  </span>
                  <Switch
                    checked={isAllLocked}
                    onCheckedChange={(checked) => handleLockAll(checked)}
                    className="data-[state=checked]:bg-red-600"
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
                  <Card key={user.id} className="bg-white/80 backdrop-blur-xl border-slate-200/60 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12 ring-2 ring-slate-400 ring-offset-2 shadow-sm">
                          <AvatarImage src={user.profile_image_url} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-600 truncate">{user.full_name}</h4>
                          <p className="text-sm text-slate-600 truncate">{user.email}</p>

                          <div className="flex items-center gap-3 mt-2">
                            <div className="text-sm">
                              <span className="font-semibold text-slate-900">{(totalMinutes / 60).toFixed(2)}h</span>
                              <span className="text-slate-500 ml-1">logged</span>
                            </div>
                            {pendingCount > 0 && (
                              <Badge className="bg-amber-100 text-amber-700">
                                {pendingCount} pending
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-3 bg-slate-50 p-2 rounded border border-slate-100">
                            <div className="flex items-center gap-2">
                              {isThisUserLoading && (
                                <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                              )}
                              <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                                {user.is_timesheet_locked ? <Lock className="w-3 h-3 text-red-500" /> : <Unlock className="w-3 h-3 text-slate-400" />}
                                Audit Lock
                              </span>
                            </div>
                            <Switch
                              checked={!!user.is_timesheet_locked}
                              onCheckedChange={(checked) => handleToggleLock(user, checked)}
                              className="scale-75"
                              disabled={isThisUserLoading}
                            />
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCreateForUser(user.email)}
                            className="mt-3 w-full"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Timesheet
                          </Button>
                        </div>
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
