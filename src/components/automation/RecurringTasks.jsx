import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Repeat, Plus, Trash2, Play, Pause } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function RecurringTasks({ currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    project_id: "",
    title: "",
    description: "",
    priority: "medium",
    frequency: "weekly",
    assigned_to: "",
    active: true,
  });

  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => groonabackend.entities.Project.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => groonabackend.entities.User.list(),
  });

  const { data: recurringTasks = [] } = useQuery({
    queryKey: ['recurring-tasks'],
    queryFn: () => groonabackend.entities.RecurringTask.list(),
  });

  const createRecurringMutation = useMutation({
    mutationFn: (data) => groonabackend.entities.RecurringTask.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-tasks'] });
      setShowForm(false);
      setFormData({
        project_id: "",
        title: "",
        description: "",
        priority: "medium",
        frequency: "weekly",
        assigned_to: "",
        active: true,
      });
    },
  });

  const updateRecurringMutation = useMutation({
    mutationFn: ({ id, data }) => groonabackend.entities.RecurringTask.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-tasks'] });
    },
  });

  const deleteRecurringMutation = useMutation({
    mutationFn: (id) => groonabackend.entities.RecurringTask.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-tasks'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createRecurringMutation.mutate(formData);
  };

  const toggleActive = (task) => {
    updateRecurringMutation.mutate({
      id: task.id,
      data: { active: !task.active }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-violet-600" />
              Recurring Tasks
            </CardTitle>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Recurring Task
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {showForm && (
            <form onSubmit={handleSubmit} className="p-6 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Project *</Label>
                  <Select
                    value={formData.project_id}
                    onValueChange={(value) => setFormData({ ...formData, project_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Frequency *</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Task Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Weekly status report"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Task description..."
                  rows={3}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Select
                    value={formData.assigned_to}
                    onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Unassigned</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.email}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRecurringMutation.isPending}>
                  {createRecurringMutation.isPending ? "Creating..." : "Create Recurring Task"}
                </Button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {recurringTasks.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                <Repeat className="h-16 w-16 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-600">No recurring tasks configured</p>
              </div>
            ) : (
              recurringTasks.map((task) => {
                const project = projects.find(p => p.id === task.project_id);
                return (
                  <div key={task.id} className="p-4 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-slate-900">{task.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            {task.frequency}
                          </Badge>
                          {task.active ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs">
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-700 border-slate-200 border text-xs">
                              Paused
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span>Project: {project?.name}</span>
                          {task.assigned_to && <span>Assigned: {task.assigned_to}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleActive(task)}
                        >
                          {task.active ? (
                            <Pause className="h-4 w-4 text-slate-600" />
                          ) : (
                            <Play className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Delete this recurring task?')) {
                              deleteRecurringMutation.mutate(task.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

