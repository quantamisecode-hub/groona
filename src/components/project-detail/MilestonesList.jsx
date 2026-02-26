import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SortAsc,
  DollarSign,
  Wallet,
  Plus,
  List,
  GitBranch,
  Map,
  Filter,
  Loader2,
  Flag,
  CheckCircle2,
  Calendar,
  Circle,
  MoreVertical,
  Pencil,
  Trash2,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import MilestoneGanttView from "./MilestoneGanttView";
import MilestoneRoadmapView from "./MilestoneRoadmapView";

export default function MilestonesList({ projectId, project }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [currentUser, setCurrentUser] = React.useState(null);
  const [viewMode, setViewMode] = useState("list"); // list, gantt, roadmap
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("due_date");
  const queryClient = useQueryClient();

  React.useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser).catch(() => { });
  }, []);

  // Fetch milestones
  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: () => groonabackend.entities.Milestone.filter({ project_id: projectId }, 'due_date'),
    enabled: !!projectId,
  });

  // Fetch tasks to calculate progress automatically
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => groonabackend.entities.Task.filter({ project_id: projectId }),
    enabled: !!projectId && viewMode === "list",
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => {
      const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id
        ? currentUser.active_tenant_id
        : currentUser?.tenant_id;

      return groonabackend.entities.Milestone.create({
        ...data,
        tenant_id: effectiveTenantId,
        project_id: projectId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      setShowDialog(false);
      setEditingMilestone(null);
      toast.success("Milestone created successfully");
    },
    onError: (err) => toast.error("Failed to create milestone: " + err.message),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => groonabackend.entities.Milestone.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      setShowDialog(false);
      setEditingMilestone(null);
      toast.success("Milestone updated successfully");
    },
    onError: (err) => toast.error("Failed to update milestone: " + err.message),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => groonabackend.entities.Milestone.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      toast.success("Milestone deleted successfully");
    },
    onError: (err) => toast.error("Failed to delete milestone: " + err.message),
  });

  const handleEdit = (milestone) => {
    setEditingMilestone(milestone);
    setShowDialog(true);
  };

  const handleStatusChange = (milestone, newStatus) => {
    updateMutation.mutate({
      id: milestone.id,
      data: { status: newStatus, progress: newStatus === 'completed' ? 100 : milestone.progress }
    });
  };

  const statusColors = {
  };

  const getMilestoneMetrics = (milestoneId) => {
    const milestone = milestones.find(m => (m.id || m._id) === milestoneId);
    const mTasks = tasks.filter(t => t.milestone_id === milestoneId);

    // Calculate dynamic progress
    const completedTasks = mTasks.filter(t => t.status === 'completed' || t.status === 'done').length;
    const calculatedProgress = mTasks.length > 0 ? Math.round((completedTasks / mTasks.length) * 100) : (milestone?.progress || 0);

    // Prioritize explicit status if it's set to 'completed' or manually overridden
    let status = milestone?.status || 'pending';

    // Only auto-upgrade to in_progress if currently pending
    // Never auto-upgrade to completed as it triggers settlement locks
    if (status === 'pending' && calculatedProgress > 0) {
      status = 'in_progress';
    }

    return { progress: calculatedProgress, status };
  };

  // Filter and sort milestones
  const filteredMilestones = React.useMemo(() => {
    let filtered = milestones;

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter(m => {
        const { status } = getMilestoneMetrics(m.id || m._id);
        return status === filterStatus;
      });
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "due_date") {
        return new Date(a.due_date) - new Date(b.due_date);
      } else if (sortBy === "start_date") {
        return new Date(a.start_date || a.due_date) - new Date(b.start_date || b.due_date);
      } else if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      } else if (sortBy === "progress") {
        const metricsA = getMilestoneMetrics(a.id || a._id);
        const metricsB = getMilestoneMetrics(b.id || b._id);
        return metricsB.progress - metricsA.progress;
      }
      return 0;
    });

    return sorted;
  }, [milestones, filterStatus, sortBy]);

  const milestonesWithMetrics = React.useMemo(() => {
    return filteredMilestones.map(m => {
      const metrics = getMilestoneMetrics(m.id || m._id);
      return { ...m, ...metrics };
    });
  }, [filteredMilestones, tasks, getMilestoneMetrics]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Project Milestones</h2>
          <p className="text-slate-600">Track key deliverables and deadlines</p>
        </div>
        <Button
          onClick={() => { setEditingMilestone(null); setShowDialog(true); }}
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Milestone
        </Button>
      </div>

      {/* View Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white p-4 rounded-lg border">
        <Tabs value={viewMode} onValueChange={setViewMode} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="list" className="gap-2">
              <List className="w-4 h-4" />
              List
            </TabsTrigger>
            <TabsTrigger value="gantt" className="gap-2">
              <GitBranch className="w-4 h-4" />
              Gantt
            </TabsTrigger>
            <TabsTrigger value="roadmap" className="gap-2">
              <Map className="w-4 h-4" />
              Roadmap
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SortAsc className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due_date">Due Date</SelectItem>
              <SelectItem value="start_date">Start Date</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="progress">Progress</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : milestonesWithMetrics.length === 0 && milestones.length === 0 ? (
        <Card className="bg-slate-50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Flag className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No milestones yet</h3>
            <p className="text-slate-500 mb-6">Create milestones to track important project events.</p>
            <Button variant="outline" onClick={() => setShowDialog(true)}>
              Create Milestone
            </Button>
          </CardContent>
        </Card>
      ) : milestonesWithMetrics.length === 0 ? (
        <Card className="bg-slate-50">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Filter className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-slate-500">No milestones match your filters</p>
            <Button variant="outline" onClick={() => { setFilterStatus("all"); setSortBy("due_date"); }} className="mt-4">
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "gantt" ? (
        <MilestoneGanttView
          milestones={milestonesWithMetrics}
          onMilestoneClick={handleEdit}
        />
      ) : viewMode === "roadmap" ? (
        <MilestoneRoadmapView
          milestones={milestonesWithMetrics}
          onMilestoneClick={handleEdit}
        />
      ) : (
        <div className="grid gap-4">
          {milestonesWithMetrics.map((milestone) => (
            <Card key={milestone.id} className="hover:shadow-md transition-all">
              <CardContent className="p-6 flex items-start gap-4">
                <div className={`mt-1 p-2 rounded-lg ${milestone.status === 'completed' ? 'bg-green-100' : 'bg-slate-100'}`}>
                  {milestone.status === 'completed' ? (
                    <CheckCircle2 className={`w-5 h-5 ${milestone.status === 'completed' ? 'text-green-600' : 'text-slate-400'}`} />
                  ) : (
                    <Flag className="w-5 h-5 text-blue-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-slate-900 truncate">
                      {milestone.name}
                    </h3>
                    <Badge className={statusColors[getMilestoneMetrics(milestone.id || milestone._id).status]} variant="secondary">
                      {getMilestoneMetrics(milestone.id || milestone._id).status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-slate-600 text-sm mb-3 line-clamp-2">
                    {milestone.description || "No description provided"}
                  </p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Due: {format(new Date(milestone.due_date), "MMM d, yyyy")}
                      </div>
                      {getMilestoneMetrics(milestone.id || milestone._id).progress > 0 && (
                        <div className="flex items-center gap-1">
                          <Circle className="w-3 h-3 fill-current text-blue-500" />
                          {getMilestoneMetrics(milestone.id || milestone._id).progress}% Complete
                        </div>
                      )}
                    </div>

                    {milestone.is_financial && (milestone.budget_value > 0 || (milestone.expense_budget || 0) > 0) && (
                      <div className="flex flex-wrap gap-2">
                        {milestone.budget_value > 0 && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 px-2 py-0.5">
                            <DollarSign className="w-3 h-3" />
                            Contract Amount: {(() => {
                              const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'dh' };
                              return symbols[milestone.currency] || milestone.currency + ' ';
                            })()}{milestone.budget_value.toLocaleString()}
                          </Badge>
                        )}
                        {(milestone.expense_budget || 0) > 0 && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 px-2 py-0.5">
                            <Wallet className="w-3 h-3" />
                            Exp. Budget: {(() => {
                              const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'dh' };
                              return symbols[milestone.currency] || milestone.currency + ' ';
                            })()}{(milestone.expense_budget || 0).toLocaleString()}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {milestone.status === 'completed' ? (
                      <DropdownMenuItem onClick={() => handleStatusChange(milestone, 'in_progress')}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Re-open Phase
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => handleEdit(milestone)}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(milestone, 'completed')}>
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Complete
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => deleteMutation.mutate(milestone.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MilestoneDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        milestone={editingMilestone}
        project={project}
        onSubmit={(data) => {
          if (editingMilestone) {
            updateMutation.mutate({ id: editingMilestone.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        loading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

function MilestoneDialog({ open, onOpenChange, milestone, project, onSubmit, loading }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    start_date: "",
    due_date: "",
    dependencies: [],
    color: "#3b82f6",
    is_financial: false,
    billing_model: "time_and_materials",
    estimated_duration: 0,
    retainer_period: "month",
    budget_value: 0,
    expense_budget: 0,
    currency: "INR",
    status: "pending",
  });

  React.useEffect(() => {
    if (open) {
      if (milestone) {
        setFormData({
          name: milestone.name,
          description: milestone.description || "",
          start_date: milestone.start_date ? milestone.start_date.split('T')[0] : "",
          due_date: milestone.due_date ? milestone.due_date.split('T')[0] : "",
          dependencies: milestone.dependencies || [],
          color: milestone.color || "#3b82f6",
          is_financial: milestone.is_financial || false,
          billing_model: milestone.billing_model || "time_and_materials",
          estimated_duration: milestone.estimated_duration || 0,
          retainer_period: milestone.retainer_period || "month",
          budget_value: milestone.budget_value || 0,
          expense_budget: milestone.expense_budget || 0,
          currency: milestone.currency || project?.currency || "INR",
          status: milestone.status || "pending",
        });
      } else {
        setFormData({
          name: "",
          description: "",
          start_date: "",
          due_date: "",
          dependencies: [],
          color: "#3b82f6",
          is_financial: project?.billing_model && project.billing_model !== 'non_billable' ? true : false,
          billing_model: project?.billing_model || "time_and_materials",
          estimated_duration: 0,
          retainer_period: "month",
          budget_value: 0,
          expense_budget: 0,
          currency: project?.currency || "INR",
          status: "pending",
        });
      }
    }
  }, [open, milestone]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{milestone ? "Edit Milestone" : "Create Milestone"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., MVP Release"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => {
                const newData = { ...formData, status: value };
                if (value === 'completed') {
                  newData.progress = 100;
                }
                setFormData(newData);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe key outcomes..."
              className="resize-none h-20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-500 font-medium text-xs">Currency (Inherited from Project)</Label>
            <div className="h-9 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-md text-slate-600 font-medium text-sm gap-2">
              <span className="opacity-70 font-bold">
                {(() => {
                  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'dh' };
                  return symbols[formData.currency] || formData.currency;
                })()}
              </span>
              {formData.currency}
            </div>
          </div>

          {/* Financial Section */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="space-y-2">
              <Label className="text-slate-500 font-medium text-xs">Billing Model (Inherited from Project)</Label>
              <Select
                value={formData.billing_model}
                disabled={true}
              >
                <SelectTrigger className="bg-slate-50 border-slate-200 text-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_price">Fixed Price</SelectItem>
                  <SelectItem value="time_and_materials">Time & Materials</SelectItem>
                  <SelectItem value="retainer">Retainer</SelectItem>
                  <SelectItem value="non_billable">Non-Billable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.billing_model !== 'non_billable' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="budget_value" className="text-emerald-700 font-semibold text-xs">
                      Contract Amount ({(() => {
                        const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'dh' };
                        return symbols[formData.currency] || formData.currency;
                      })()})
                    </Label>
                    <Input
                      id="budget_value"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.budget_value}
                      onChange={(e) => setFormData({ ...formData, budget_value: parseFloat(e.target.value) || 0 })}
                      placeholder="Amount"
                      className="border-emerald-200 focus:ring-emerald-500 bg-white h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expense_budget" className="text-amber-700 font-semibold text-xs">
                      Exp. Budget ({(() => {
                        const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'dh' };
                        return symbols[formData.currency] || formData.currency;
                      })()})
                    </Label>
                    <Input
                      id="expense_budget"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.expense_budget}
                      onChange={(e) => setFormData({ ...formData, expense_budget: parseFloat(e.target.value) || 0 })}
                      placeholder="Budget"
                      className="border-amber-200 focus:ring-amber-500 bg-white h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {formData.billing_model === 'time_and_materials' && (
                    <div className="space-y-2">
                      <Label htmlFor="estimated_duration" className="text-blue-700 font-semibold">Est. Duration (Hours)</Label>
                      <Input
                        id="estimated_duration"
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.estimated_duration}
                        onChange={(e) => setFormData({ ...formData, estimated_duration: parseFloat(e.target.value) || 0 })}
                        placeholder="Hours"
                        className="border-blue-200 focus:ring-blue-500 bg-white h-9"
                      />
                    </div>
                  )}
                  {formData.billing_model === 'retainer' && (
                    <div className="space-y-2">
                      <Label className="text-indigo-700 font-semibold">Retainer Period</Label>
                      <Select
                        value={formData.retainer_period}
                        onValueChange={(value) => setFormData({ ...formData, retainer_period: value })}
                      >
                        <SelectTrigger className="bg-white border-indigo-200 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="week">Weekly</SelectItem>
                          <SelectItem value="month">Monthly</SelectItem>
                          <SelectItem value="quarter">Quarterly</SelectItem>
                          <SelectItem value="year">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-gradient-to-r from-blue-500 to-purple-600">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {milestone ? "Update Milestone" : "Create Milestone"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

