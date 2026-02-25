import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TimesheetEntry({ open, onClose, onSubmit, loading, projects, tasks }) {
  const [formData, setFormData] = useState({
    project_id: "",
    task_id: "",
    date: new Date().toISOString().split('T')[0],
    hours: "",
    description: "",
  });

  const [projectTasks, setProjectTasks] = useState([]);

  useEffect(() => {
    if (formData.project_id) {
      const filtered = tasks.filter(t => t.project_id === formData.project_id);
      setProjectTasks(filtered);
      
      const selectedProject = projects.find(p => p.id === formData.project_id);
      if (selectedProject) {
        setFormData(prev => ({
          ...prev,
          project_name: selectedProject.name,
        }));
      }
    } else {
      setProjectTasks([]);
    }
  }, [formData.project_id, tasks, projects]);

  useEffect(() => {
    if (formData.task_id) {
      const selectedTask = tasks.find(t => t.id === formData.task_id);
      if (selectedTask) {
        setFormData(prev => ({
          ...prev,
          task_title: selectedTask.title,
        }));
      }
    }
  }, [formData.task_id, tasks]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      hours: parseFloat(formData.hours),
    });
    setFormData({
      project_id: "",
      task_id: "",
      date: new Date().toISOString().split('T')[0],
      hours: "",
      description: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">Log Time</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Project *</Label>
            <Select
              value={formData.project_id}
              onValueChange={(value) => setFormData({ ...formData, project_id: value, task_id: "" })}
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
            <Label>Task (Optional)</Label>
            <Select
              value={formData.task_id}
              onValueChange={(value) => setFormData({ ...formData, task_id: value })}
              disabled={!formData.project_id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select task (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>No specific task</SelectItem>
                {projectTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours">Hours *</Label>
            <Input
              id="hours"
              type="number"
              min="0.25"
              max="24"
              step="0.25"
              value={formData.hours}
              onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
              placeholder="e.g., 8.5"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What did you work on?"
              rows={3}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
            >
              {loading ? "Saving..." : "Log Time"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}