import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Plus, CheckCircle, Clock, X, FolderKanban, BookOpen, Calendar, User, UserCheck, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useUser } from "@/components/shared/UserContext";
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
import { notificationService } from "@/components/shared/notificationService";

export default function ImpedimentTracker({ sprint, project: propProject, projectId, impediments: propImpediments, onAdd, onUpdate, onDelete, highlightImpedimentId }) {
  const { user: currentUser } = useUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const [showTimesheetPrompt, setShowTimesheetPrompt] = useState(false);
  const [pendingTimesheetId, setPendingTimesheetId] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    severity: "medium",
    status: "open",
    task_id: "",
    assigned_to: [],
    project_manager_id: "",
    due_date: ""
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    id: null
  });

  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id
    ? currentUser.active_tenant_id
    : currentUser?.tenant_id;

  // Fetch impediments from database
  const { data: dbImpediments = [], isLoading: impedimentsLoading } = useQuery({
    queryKey: ['impediments', projectId, sprint?.id],
    queryFn: async () => {
      if (!projectId) return [];
      const filters = { project_id: projectId };
      if (sprint?.id) {
        filters.sprint_id = sprint.id;
      }
      return await groonabackend.entities.Impediment.filter(filters);
    },
    enabled: !!projectId,
  });

  // Handle Deep Linking / Scrolling
  useEffect(() => {
    if (highlightImpedimentId && !impedimentsLoading) {
      const element = document.getElementById(`impediment-card-${highlightImpedimentId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Optional: Add a temporary flash effect class if needed, or rely on the persistent highlight below
      }
    }
  }, [highlightImpedimentId, impedimentsLoading, dbImpediments, propImpediments]);

  // Fetch related entities for context
  const { data: epics = [] } = useQuery({
    queryKey: ['epics', projectId],
    queryFn: () => groonabackend.entities.Epic.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: stories = [] } = useQuery({
    queryKey: ['stories', projectId],
    queryFn: () => groonabackend.entities.Story.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => groonabackend.entities.Sprint.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => groonabackend.entities.Task.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => groonabackend.entities.User.list(),
  });

  const { data: dbProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await groonabackend.entities.Project.filter({ id: projectId });
      return projects[0] || null;
    },
    enabled: !!projectId && !propProject
  });

  const project = propProject || dbProject;

  const projectTeamMembers = useMemo(() => {
    if (!project?.team_members?.length) {
      return (users || []).filter(u => u.tenant_id === effectiveTenantId).map(u => ({
        ...u,
        projectRole: u.role
      }));
    }
    return project.team_members.map(tm => {
      const user = users.find(u => u.email === tm.email);
      return {
        ...(user || { email: tm.email, full_name: tm.email }),
        id: user?.id || user?._id || tm.email,
        projectRole: tm.role
      };
    });
  }, [project, users, effectiveTenantId]);

  // Ensure we only use filtered impediments if they are being managed by a project/database fetch
  const rawImpediments = (projectId && !impedimentsLoading) ? dbImpediments : (propImpediments || []);

  // --- STRICT FRONTEND RBAC: Double-layer Filter ---
  // Only show impediments that the user is authorized to see
  const impediments = useMemo(() => {
    if (!currentUser || currentUser.is_super_admin) return rawImpediments;

    const uEmail = (currentUser.email || '').toLowerCase();
    const uId = (currentUser.id || currentUser._id || '').toString().toLowerCase();
    const uName = (currentUser.full_name || currentUser.name || '').toLowerCase();

    return rawImpediments.filter(imp => {
      const fields = [
        imp.reported_by,
        imp.reported_by_name,
        imp.assigned_to,
        imp.assigned_to_name,
        imp.project_manager_id,
        imp.project_manager_name
      ];

      return fields.some(f => {
        if (!f) return false;
        const val = f.toString().toLowerCase();

        // Similarity check: email/ID can be part of the field (e.g. name + email)
        return (uEmail && val.includes(uEmail)) ||
          (uId && (val.includes(uId) || uId.includes(val))) ||
          (uName && val.includes(uName));
      });
    });
  }, [rawImpediments, currentUser]);

  // Mutation for adding impediment
  const addImpedimentMutation = useMutation({
    mutationFn: async (data) => {
      if (!effectiveTenantId) throw new Error('Tenant context is missing');
      const assignedUserNames = Array.isArray(data.assigned_to) ? data.assigned_to.map(id => {
        const u = users.find(usr => (usr.id || usr._id) === id || usr.email === id);
        return u ? (u.full_name || u.email) : id;
      }) : [];
      const projectManager = users.find(u => (u.id || u._id) === data.project_manager_id || u.email === data.project_manager_id);

      const impedimentData = {
        tenant_id: effectiveTenantId,
        project_id: projectId,
        project_name: project?.name,
        sprint_id: sprint?.id || undefined,
        sprint_name: sprint?.name,
        task_id: (data.task_id && data.task_id !== 'none') ? data.task_id : undefined,
        title: data.title.trim(),
        description: data.description || "",
        severity: data.severity,
        assigned_to: Array.isArray(data.assigned_to) ? data.assigned_to : [data.assigned_to],
        assigned_to_name: assignedUserNames,
        due_date: data.due_date || undefined,
        project_manager_id: data.project_manager_id,
        project_manager_name: projectManager ? (projectManager.full_name || projectManager.email) : undefined,
        status: "open",
        reported_by: currentUser?.email,
        reported_by_name: currentUser?.full_name || currentUser?.email,
      };
      return await groonabackend.entities.Impediment.create(impedimentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impediments'] });
      toast.success('Impediment reported successfully!');
      setFormData({
        title: "",
        description: "",
        severity: "medium",
        status: "open",
        task_id: "",
        assigned_to: [],
        project_manager_id: "",
        due_date: ""
      });
      setShowDialog(false);
      if (onAdd) onAdd(formData);
    },
    onError: (error) => {
      toast.error(`Failed to report impediment: ${error.message || 'Please try again.'}`);
    },
  });

  // Mutation for updating impediment
  const updateImpedimentMutation = useMutation({
    mutationFn: async ({ id, data, impediment }) => {
      const updateData = { ...data };
      if (data.status === 'resolved') {
        updateData.resolved_date = new Date().toISOString();
      }

      // Auto start timer logic
      if (data.status === 'in_progress' && impediment) {
        const entries = await groonabackend.entities.ClockEntry.filter({
          user_email: currentUser?.email,
          is_clocked_in: true
        });
        if (entries && entries.length > 0) {
          throw new Error('You already have an active timer running! Please stop it before starting work on this impediment.');
        }

        // Create the timer entry for this impediment
        await groonabackend.entities.ClockEntry.create({
          tenant_id: effectiveTenantId,
          user_email: currentUser?.email,
          user_name: currentUser?.full_name,
          clock_in_time: new Date().toISOString(),
          is_clocked_in: true,
          project_id: impediment.project_id || projectId,
          sprint_id: impediment.sprint_id || sprint?.id || null,
          task_id: (impediment.task_id && impediment.task_id !== 'none') ? impediment.task_id : null,
          work_type: 'impediment',
          description: `Working on Impediment: ${impediment.title}`,
        });
      }

      // Auto stop timer logic
      let promptSubmit = false;
      if (data.status === 'resolved' && impediment) {
        const entries = await groonabackend.entities.ClockEntry.filter({
          user_email: currentUser?.email,
          is_clocked_in: true,
          work_type: 'impediment'
        });
        const thisTimer = entries.find(e => e.description === `Working on Impediment: ${impediment.title}` && e.project_id === (impediment.project_id || projectId));

        if (thisTimer) {
          const endTime = new Date();
          const startTime = new Date(thisTimer.clock_in_time);
          const diffInMs = endTime.getTime() - startTime.getTime();
          const rawMinutes = Math.floor(diffInMs / 60000);
          const totalMinutes = Math.max(0, rawMinutes - (thisTimer.total_paused_seconds ? Math.floor(thisTimer.total_paused_seconds / 60) : 0));

          const timesheet = await groonabackend.entities.Timesheet.create({
            tenant_id: effectiveTenantId,
            user_email: currentUser?.email,
            user_name: currentUser?.full_name,
            date: format(startTime, 'yyyy-MM-dd'),
            project_id: thisTimer.project_id,
            project_name: impediment.project_name || project?.name || '',
            sprint_id: thisTimer.sprint_id || null,
            task_id: (thisTimer.task_id && thisTimer.task_id !== 'none') ? thisTimer.task_id : null,
            task_title: impediment.title,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            hours: Math.floor(totalMinutes / 60),
            minutes: totalMinutes % 60,
            total_minutes: totalMinutes,
            description: thisTimer.description,
            work_type: 'impediment',
            entry_type: 'clock_in_out',
            status: 'draft',
            is_billable: true,
            is_locked: false,
            snapshot_hourly_rate: currentUser?.hourly_rate || 0,
            snapshot_total_cost: (totalMinutes / 60) * (currentUser?.hourly_rate || 0),
          });

          await groonabackend.entities.ClockEntry.update(thisTimer.id || thisTimer._id, {
            is_clocked_in: false,
            clock_out_time: endTime.toISOString(),
            total_minutes: totalMinutes,
            timesheet_id: timesheet.id || timesheet._id
          });

          promptSubmit = true;
          return { ...await groonabackend.entities.Impediment.update(id, updateData), promptSubmit, timesheetId: timesheet.id || timesheet._id };
        }
      }

      const returnedImp = await groonabackend.entities.Impediment.update(id, updateData);
      return { ...returnedImp, promptSubmit };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['impediments'] });

      // Trigger Resolution Notification
      if (variables.data.status === 'resolved') {
        notificationService.notifyImpedimentResolved({
          impediment: { ...variables.impediment, id: variables.id },
          resolvedBy: currentUser?.email,
          tenantId: effectiveTenantId
        }).catch(err => console.error('Notification failed:', err));
      }

      if (variables.data.status === 'in_progress') {
        queryClient.invalidateQueries({ queryKey: ['active-clock-entry'] });
        toast.success(`Timer started! Marked '${variables.impediment?.title || "Impediment"}' as In Progress.`);
      } else {
        toast.success('Impediment status updated successfully!');
      }

      if (data && data.promptSubmit) {
        queryClient.invalidateQueries({ queryKey: ['active-clock-entry'] });
        queryClient.invalidateQueries({ queryKey: ['my-timesheets'] });
        setPendingTimesheetId(data.timesheetId);
        setShowTimesheetPrompt(true);
      }

      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      toast.error(`${error.message || 'Failed to update impediment! Please try again.'}`);
    },
  });

  // Mutation for deleting impediment
  const deleteImpedimentMutation = useMutation({
    mutationFn: async (id) => {
      return await groonabackend.entities.Impediment.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impediments'] });
      if (onDelete) onDelete();
    },
    onError: (error) => {
      toast.error(`Failed to delete impediment: ${error.message || 'Please try again.'}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    addImpedimentMutation.mutate(formData);
  };

  const handleUpdate = (imp, data) => {
    updateImpedimentMutation.mutate({ id: imp.id || imp._id, data, impediment: imp });
  };

  const handleDelete = (id) => {
    setDeleteConfirmation({
      isOpen: true,
      id
    });
  };

  const severityColors = {
    low: "bg-blue-100 text-blue-700 border-blue-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    high: "bg-red-100 text-red-700 border-red-200",
    critical: "bg-purple-100 text-purple-700 border-purple-200"
  };

  const statusIcons = {
    open: { icon: AlertTriangle, color: "text-red-600" },
    in_progress: { icon: Clock, color: "text-blue-600" },
    resolved: { icon: CheckCircle, color: "text-green-600" }
  };

  const openImpediments = impediments.filter(i => i.status === 'open');
  const inProgressImpediments = impediments.filter(i => i.status === 'in_progress');
  const resolvedImpediments = impediments.filter(i => i.status === 'resolved');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Sprint Impediments</h3>
          <p className="text-slate-500">Track and resolve blockers</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" />
          Report Impediment
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 font-medium">Open</p>
                <p className="text-3xl font-bold text-red-900">{openImpediments.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">In Progress</p>
                <p className="text-3xl font-bold text-blue-900">{inProgressImpediments.length}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">Resolved</p>
                <p className="text-3xl font-bold text-green-900">{resolvedImpediments.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Impediments List */}
      <div className="space-y-4">
        {impediments.length === 0 ? (
          <Card className="bg-slate-50 border-dashed">
            <CardContent className="p-12 text-center">
              <CheckCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No impediments reported - great job!</p>
            </CardContent>
          </Card>
        ) : (
          impediments.map(impediment => {
            const StatusIcon = statusIcons[impediment.status].icon;
            const statusColor = statusIcons[impediment.status].color;

            // Authorization logic for buttons
            const isOwner = currentUser?.role === 'admin' && currentUser?.custom_role === 'owner';
            const isPM = currentUser?.role === 'admin' && currentUser?.custom_role === 'project_manager';
            const isAssigned = Array.isArray(impediment.assigned_to)
              ? impediment.assigned_to.includes(currentUser?.id || currentUser?._id)
              : impediment.assigned_to === (currentUser?.id || currentUser?._id) || impediment.assigned_to === currentUser?.email;

            // Only resolvers (assigned to this impediment) can see the action buttons. 
            // Others, including PMs who are not assigned, and Owners, cannot see them.
            const canAction = !isOwner && isAssigned;

            return (
              <Card
                key={impediment.id}
                id={`impediment-card-${impediment.id || impediment._id}`}
                className={`${impediment.status === 'open' ? 'border-red-200' : ''} ${(impediment.id || impediment._id) === highlightImpedimentId ? 'ring-2 ring-blue-500 shadow-lg bg-blue-50/50' : ''
                  }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <StatusIcon className={`h-5 w-5 ${statusColor} mt-0.5`} />
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <h4 className="font-semibold text-slate-900">{impediment.title}</h4>
                          <p className="text-sm text-slate-600 mt-1">{impediment.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={severityColors[impediment.severity]}>
                            {impediment.severity}
                          </Badge>
                          {impediment.status !== 'resolved' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(impediment.id || impediment._id)}
                              className="h-7 w-7"
                              disabled={deleteImpedimentMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Metadata Row */}
                      <div className="mt-4 flex flex-wrap gap-4 pt-4 border-t border-slate-50 items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reported By</span>
                            <div className="flex items-center gap-1.5">
                              <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                {impediment.reported_by_name?.charAt(0) || 'U'}
                              </div>
                              <span className="text-xs font-semibold text-slate-700">{impediment.reported_by_name || impediment.reported_by}</span>
                            </div>
                          </div>

                          {impediment.assigned_to_name && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Resolver(s)</span>
                              <div className="flex items-center gap-1.5 bg-blue-50/50 px-2 py-0.5 rounded-lg border border-blue-100/50">
                                <UserCheck className="h-3 w-3 text-blue-500" />
                                <span className="text-xs font-bold text-blue-700">
                                  {Array.isArray(impediment.assigned_to_name) ? impediment.assigned_to_name.join(', ') : impediment.assigned_to_name}
                                </span>
                              </div>
                            </div>
                          )}

                          {impediment.project_manager_name && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Manager</span>
                              <div className="flex items-center gap-1.5 bg-purple-50/50 px-2 py-0.5 rounded-lg border border-purple-100/50">
                                <ShieldCheck className="h-3 w-3 text-purple-500" />
                                <span className="text-xs font-bold text-purple-700">{impediment.project_manager_name}</span>
                              </div>
                            </div>
                          )}

                          {impediment.due_date && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Due Date</span>
                              <div className="flex items-center gap-1.5 bg-rose-50/50 px-2 py-0.5 rounded-lg border border-rose-100/50">
                                <Calendar className="h-3 w-3 text-rose-500" />
                                <span className="text-xs font-bold text-rose-700">{format(new Date(impediment.due_date), 'MMM d, yyyy')}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-slate-400 font-medium">
                            {format(new Date(impediment.created_date || impediment.createdAt || new Date()), 'MMM d, h:mm a')}
                          </span>
                        </div>
                      </div>

                      {/* Context Tags */}
                      <div className="mt-3 flex items-center gap-2 text-xs flex-wrap">
                        {impediment.project_name && (
                          <Badge variant="ghost" className="text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-500 font-medium py-0 px-2 h-5 border border-slate-200/50 rounded-md">
                            {impediment.project_name}
                          </Badge>
                        )}
                        {(impediment.sprint_id || impediment.sprint_name) && (() => {
                          const relatedSprint = sprints.find(s => (s.id || s._id) === impediment.sprint_id);
                          const sprintName = relatedSprint?.name || impediment.sprint_name;
                          return sprintName ? (
                            <Badge variant="ghost" className="text-[10px] bg-indigo-50/50 hover:bg-indigo-50 text-indigo-500 font-medium py-0 px-2 h-5 border border-indigo-100/50 rounded-md">
                              <Calendar className="h-2.5 w-2.5 mr-1" />
                              {sprintName}
                            </Badge>
                          ) : null;
                        })()}
                        {impediment.task_id && (() => {
                          const relatedTask = tasks.find(t => (t.id || t._id) === impediment.task_id);
                          return relatedTask ? (
                            <Badge variant="ghost" className="text-[10px] bg-amber-50/50 hover:bg-amber-50 text-amber-600 font-medium py-0 px-2 h-5 border border-amber-200/50 rounded-md">
                              Task: {relatedTask.title}
                            </Badge>
                          ) : null;
                        })()}
                      </div>

                      {impediment.status !== 'resolved' && canAction && (
                        <div className="mt-3 flex gap-2">
                          {impediment.status === 'open' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdate(impediment, { status: 'in_progress' })}
                              disabled={updateImpedimentMutation.isPending}
                            >
                              Start Working
                            </Button>
                          )}
                          {impediment.status === 'in_progress' && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleUpdate(impediment, { status: 'resolved' })}
                              disabled={updateImpedimentMutation.isPending}
                            >
                              Mark Resolved
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Add Impediment Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-xl font-bold text-slate-900">Report Impediment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Title</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Brief description of the impediment"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed explanation and impact"
                rows={4}
              />
            </div>

            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Current Context
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="outline" className="bg-white border-blue-100 text-blue-700 py-1.5 px-3 rounded-lg shadow-sm">
                  <span className="opacity-60 font-bold mr-1.5">Project:</span> {project?.name || 'Loading...'}
                </Badge>
                <Badge variant="outline" className="bg-white border-purple-100 text-purple-700 py-1.5 px-3 rounded-lg shadow-sm">
                  <span className="opacity-60 font-bold mr-1.5">Sprint:</span> {sprint?.name || 'Loading...'}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Related Task</label>
                <Select value={formData.task_id || "none"} onValueChange={(val) => setFormData({ ...formData, task_id: val === 'none' ? "" : val })}>
                  <SelectTrigger className="border-slate-300 focus:ring-blue-500 shadow-sm transition-all focus:border-blue-500">
                    <SelectValue placeholder="Select task" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-slate-400" />
                        No specific task
                      </div>
                    </SelectItem>
                    {tasks.map(task => (
                      <SelectItem key={task.id || task._id} value={task.id || task._id}>
                        <div className="flex items-center gap-2">
                          <FolderKanban className="h-4 w-4 text-blue-500" />
                          <span className="truncate">{task.title}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Severity</label>
                <Select value={formData.severity} onValueChange={(val) => setFormData({ ...formData, severity: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Minor inconvenience</SelectItem>
                    <SelectItem value="medium">Medium - Slowing progress</SelectItem>
                    <SelectItem value="high">High - Blocking work</SelectItem>
                    <SelectItem value="critical">Critical - Sprint at risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium mb-2 block">Assign To (Viewer Member)</label>
                {(formData.assigned_to && formData.assigned_to.length > 0) && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.assigned_to.map(id => {
                      const u = projectTeamMembers.find(usr => (usr.id || usr._id) === id);
                      const displayName = u ? (u.full_name || u.email) : id;
                      return (
                        <Badge key={id} variant="secondary" className="flex items-center gap-1.5 py-1 px-2.5">
                          {displayName}
                          <X
                            className="h-3.5 w-3.5 cursor-pointer hover:text-red-500 transition-colors ml-1"
                            onClick={() => setFormData({
                              ...formData,
                              assigned_to: formData.assigned_to.filter(i => i !== id)
                            })}
                          />
                        </Badge>
                      );
                    })}
                  </div>
                )}
                <Select
                  value=""
                  onValueChange={(val) => {
                    if (!formData.assigned_to.includes(val)) {
                      setFormData({ ...formData, assigned_to: [...(formData.assigned_to || []), val] });
                    }
                  }}
                >
                  <SelectTrigger className="border-slate-300 focus:ring-blue-500 shadow-sm transition-all">
                    <SelectValue placeholder="Add assigned user(s)" />
                  </SelectTrigger>
                  <SelectContent side="top" className="max-h-60">
                    {projectTeamMembers
                      .filter(u => u.role === 'member' && u.custom_role === 'viewer')
                      .filter(u => !formData.assigned_to?.includes(u.id || u._id))
                      .map(user => {
                        const displayName = user.full_name || user.email || 'U';
                        return (
                          <SelectItem key={user.id || user._id} value={user.id || user._id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5 border border-slate-300 shadow-sm shrink-0">
                                <AvatarImage src={user.profile_image_url || user.profile_picture_url} />
                                <AvatarFallback className="bg-slate-200 text-[10px] font-bold text-slate-700 uppercase">
                                  {displayName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate">{displayName}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Project Manager</label>
                <Select value={formData.project_manager_id} onValueChange={(val) => setFormData({ ...formData, project_manager_id: val })}>
                  <SelectTrigger className="border-slate-300 focus:ring-blue-500 shadow-sm transition-all">
                    <SelectValue placeholder="Select PM" />
                  </SelectTrigger>
                  <SelectContent side="top" className="max-h-60">
                    {projectTeamMembers
                      .filter(u => u.projectRole === 'project_manager' || u.role === 'project_manager')
                      .map(user => {
                        const displayName = user.full_name || user.email || 'U';
                        return (
                          <SelectItem key={user.id || user._id} value={user.id || user._id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5 border border-slate-300 shadow-sm shrink-0">
                                <AvatarImage src={user.profile_image_url || user.profile_picture_url} />
                                <AvatarFallback className="bg-slate-200 text-[10px] font-bold text-slate-700 uppercase">
                                  {displayName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate">{displayName}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Due Date</label>
                <Input
                  type="date"
                  value={formData.due_date || ""}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="border-slate-300 focus:ring-blue-500 shadow-sm transition-all"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700">
                Report Impediment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteConfirmation.isOpen}
        onOpenChange={(open) => setDeleteConfirmation(prev => ({ ...prev, isOpen: open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Impediment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this impediment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmation.id) {
                  deleteImpedimentMutation.mutate(deleteConfirmation.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Timesheet Submission Prompt */}
      <AlertDialog open={showTimesheetPrompt} onOpenChange={setShowTimesheetPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Timer Stopped Automatically</AlertDialogTitle>
            <AlertDialogDescription>
              We've stopped your timer since you've marked the blocker as resolved. A draft timesheet has been created.
              Do you want to submit your timesheet now or submit it later?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowTimesheetPrompt(false)}>Ignore Now</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowTimesheetPrompt(false);
                const url = pendingTimesheetId ? `/timesheets?editId=${pendingTimesheetId}` : '/timesheets';
                navigate(url);
              }}
            >
              Submit Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

