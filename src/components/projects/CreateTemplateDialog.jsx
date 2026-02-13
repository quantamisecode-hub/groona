import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CreateTemplateDialog({ open, onClose, template = null }) {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "custom",
    default_priority: "medium",
    default_status: "planning",
    estimated_duration_days: 30,
    task_templates: [],
    milestones: [],
    is_public: true,
  });

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    task_type: "task",
    priority: "medium",
    estimated_hours: 0,
  });

  useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description || "",
        category: template.category || "custom",
        default_priority: template.default_priority || "medium",
        default_status: template.default_status || "planning",
        estimated_duration_days: template.estimated_duration_days || 30,
        task_templates: template.task_templates || [],
        milestones: template.milestones || [],
        is_public: template.is_public !== false,
      });
    } else if (open) {
      setFormData({
        name: "",
        description: "",
        category: "custom",
        default_priority: "medium",
        default_status: "planning",
        estimated_duration_days: 30,
        task_templates: [],
        milestones: [],
        is_public: true,
      });
      setNewTask({
        title: "",
        description: "",
        task_type: "task",
        priority: "medium",
        estimated_hours: 0,
      });
    }
  }, [template, open]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        created_by: currentUser?.email,
      };

      if (template) {
        return groonabackend.entities.ProjectTemplate.update(template.id, payload);
      } else {
        return groonabackend.entities.ProjectTemplate.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-templates'] });
      toast.success(template ? 'Template updated successfully' : 'Template created successfully');
      onClose();
    },
    onError: (error) => {
      console.error('Save error:', error);
      toast.error('Failed to save template');
    },
  });

  const handleAddTask = () => {
    if (!newTask.title.trim()) {
      toast.error('Task title is required');
      return;
    }

    setFormData(prev => ({
      ...prev,
      task_templates: [
        ...prev.task_templates,
        {
          ...newTask,
          order: prev.task_templates.length,
        }
      ]
    }));

    setNewTask({
      title: "",
      description: "",
      task_type: "task",
      priority: "medium",
      estimated_hours: 0,
    });
  };

  const handleRemoveTask = (index) => {
    setFormData(prev => ({
      ...prev,
      task_templates: prev.task_templates.filter((_, i) => i !== index)
    }));
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('Template name is required');
      return;
    }

    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Edit Template' : 'Create Project Template'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Website Redesign"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this template is for..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="software_development">Software Development</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="construction">Construction</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="product_launch">Product Launch</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="duration">Estimated Duration (days)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.estimated_duration_days}
                  onChange={(e) => setFormData({ ...formData, estimated_duration_days: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Default Priority</Label>
                <Select
                  value={formData.default_priority}
                  onValueChange={(value) => setFormData({ ...formData, default_priority: value })}
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

              <div>
                <Label htmlFor="status">Default Status</Label>
                <Select
                  value={formData.default_status}
                  onValueChange={(value) => setFormData({ ...formData, default_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Task Templates */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-slate-900">Task Templates</h3>
            
            <div className="space-y-3">
              {formData.task_templates.map((task, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{task.title}</p>
                    <p className="text-xs text-slate-600">
                      {task.task_type} • {task.priority} priority • {task.estimated_hours}h
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemoveTask(index)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-slate-900">Add Task Template</p>
              <div className="space-y-2">
                <Input
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                />
                <Textarea
                  placeholder="Task description (optional)"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  rows={2}
                />
                <div className="grid grid-cols-3 gap-2">
                  <Select
                    value={newTask.task_type}
                    onValueChange={(value) => setNewTask({ ...newTask, task_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="story">Story</SelectItem>
                      <SelectItem value="bug">Bug</SelectItem>
                      <SelectItem value="epic">Epic</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={newTask.priority}
                    onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
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
                  <Input
                    type="number"
                    placeholder="Hours"
                    value={newTask.estimated_hours}
                    onChange={(e) => setNewTask({ ...newTask, estimated_hours: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <Button
                  onClick={handleAddTask}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                template ? 'Update Template' : 'Create Template'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

