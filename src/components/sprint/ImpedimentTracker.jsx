import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Plus, CheckCircle, Clock, X, FolderKanban, BookOpen, Calendar } from "lucide-react";
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

export default function ImpedimentTracker({ sprint, projectId, impediments: propImpediments, onAdd, onUpdate, onDelete, highlightImpedimentId }) {
  const { user: currentUser } = useUser();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    severity: "medium",
    status: "open"
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

  // Use database impediments if available, otherwise fall back to prop impediments
  const impediments = dbImpediments.length > 0 ? dbImpediments : (propImpediments || []);

  // Mutation for adding impediment
  const addImpedimentMutation = useMutation({
    mutationFn: async (data) => {
      if (!effectiveTenantId) throw new Error('Tenant context is missing');
      const impedimentData = {
        tenant_id: effectiveTenantId,
        project_id: projectId,
        sprint_id: sprint?.id || undefined,
        title: data.title.trim(),
        description: data.description || "",
        severity: data.severity,
        status: "open",
        reported_by: currentUser?.email,
        reported_by_name: currentUser?.full_name || currentUser?.email,
      };
      return await groonabackend.entities.Impediment.create(impedimentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impediments', projectId, sprint?.id] });
      toast.success('Impediment reported successfully!');
      setFormData({ title: "", description: "", severity: "medium", status: "open" });
      setShowDialog(false);
      if (onAdd) onAdd(formData);
    },
    onError: (error) => {
      toast.error(`Failed to report impediment: ${error.message || 'Please try again.'}`);
    },
  });

  // Mutation for updating impediment
  const updateImpedimentMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const updateData = { ...data };
      if (data.status === 'resolved') {
        updateData.resolved_date = new Date().toISOString();
      }
      return await groonabackend.entities.Impediment.update(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impediments', projectId, sprint?.id] });
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      toast.error(`Failed to update impediment: ${error.message || 'Please try again.'}`);
    },
  });

  // Mutation for deleting impediment
  const deleteImpedimentMutation = useMutation({
    mutationFn: async (id) => {
      return await groonabackend.entities.Impediment.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impediments', projectId, sprint?.id] });
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

  const handleUpdate = (id, data) => {
    updateImpedimentMutation.mutate({ id, data });
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

                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        <span>Reported: {format(new Date(impediment.created_date || impediment.createdAt || new Date()), 'MMM d, yyyy')}</span>
                        <span>By: {impediment.reported_by_name || impediment.reported_by || impediment.created_by}</span>
                        {/* Show context: Sprint, Epic, Story */}
                        {impediment.sprint_id && (() => {
                          const relatedSprint = sprints.find(s => (s.id || s._id) === impediment.sprint_id);
                          return relatedSprint ? (
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="h-3 w-3 mr-1" />
                              Sprint: {relatedSprint.name}
                            </Badge>
                          ) : null;
                        })()}
                        {impediment.epic_id && (() => {
                          const relatedEpic = epics.find(e => (e.id || e._id) === impediment.epic_id);
                          return relatedEpic ? (
                            <Badge variant="outline" className="text-xs">
                              <FolderKanban className="h-3 w-3 mr-1" />
                              Epic: {relatedEpic.name}
                            </Badge>
                          ) : null;
                        })()}
                        {impediment.story_id && (() => {
                          const relatedStory = stories.find(s => (s.id || s._id) === impediment.story_id);
                          return relatedStory ? (
                            <Badge variant="outline" className="text-xs">
                              <BookOpen className="h-3 w-3 mr-1" />
                              Story: {relatedStory.title}
                            </Badge>
                          ) : null;
                        })()}
                      </div>

                      {impediment.status !== 'resolved' && (
                        <div className="mt-3 flex gap-2">
                          {impediment.status === 'open' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdate(impediment.id || impediment._id, { status: 'in_progress' })}
                              disabled={updateImpedimentMutation.isPending}
                            >
                              Start Working
                            </Button>
                          )}
                          {impediment.status === 'in_progress' && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleUpdate(impediment.id || impediment._id, { status: 'resolved' })}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Impediment</DialogTitle>
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
    </div>
  );
}

