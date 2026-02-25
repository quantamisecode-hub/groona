import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUser } from "@/components/shared/UserContext";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { toast } from "sonner";
import { FolderKanban, AlignLeft, Circle, Flag, Calendar as CalendarIcon, Palette, Wand2, Loader2 } from "lucide-react";

export default function CreateEpicDialog({ open, onClose, projectId, epic, onSuccess }) {
  const { user: currentUser, tenant } = useUser();
  const isEditMode = !!epic;
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "planning",
    priority: "medium",
    start_date: "",
    due_date: "",
    color: "#3b82f6",
    owner: "",
    labels: [],
  });
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  useEffect(() => {
    if (open) {
      if (epic) {
        // Edit mode - populate with epic data
        setFormData({
          name: epic.name || "",
          description: epic.description || "",
          status: epic.status || "planning",
          priority: epic.priority || "medium",
          start_date: epic.start_date ? epic.start_date.split('T')[0] : "",
          due_date: epic.due_date ? epic.due_date.split('T')[0] : "",
          color: epic.color || "#3b82f6",
          owner: epic.owner || currentUser?.email || "",
          labels: epic.labels || [],
        });
      } else if (currentUser) {
        // Create mode - set defaults
        setFormData(prev => ({ ...prev, owner: currentUser.email }));
      }
    }
  }, [open, currentUser, epic]);

  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id
    ? currentUser.active_tenant_id
    : currentUser?.tenant_id;

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await groonabackend.entities.Project.list();
      return projects.find(p => (p.id === projectId) || (p._id === projectId));
    },
    enabled: !!projectId && open,
  });

  const handleGenerateDescription = async () => {
    if (!formData.name?.trim()) {
      toast.error("Please enter an Epic Name first.");
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const prompt = `You are a senior project manager. Based on the epic name "${formData.name}" and any initial description provided ("${formData.description || ''}"), generate a brief, concise epic description.

      The description should be a short summary (1-2 paragraphs) explaining the goal and purpose of this epic.
      Do NOT use structured headers like "Scope", "Requirements", "In-Scope", or "Deliverables".
      Keep it simple and direct.
      
      Output only the description text (no JSON, no markdown formatting, just plain descriptive text).`;

      const response = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            description: { type: "string" }
          }
        }
      });

      const generatedDescription = response.description || response;
      setFormData(prev => ({ ...prev, description: generatedDescription }));
      toast.success("Epic description generated successfully!");
    } catch (error) {
      console.error("AI Generation Error:", error);
      toast.error("Failed to generate epic description. Please check your connection.");
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Epic name is required');
      return;
    }

    if (!effectiveTenantId) {
      toast.error('Tenant context is missing');
      return;
    }

    try {
      const epicData = {
        tenant_id: effectiveTenantId,
        workspace_id: project?.workspace_id || "",
        project_id: projectId,
        name: formData.name.trim(),
        description: formData.description || "",
        status: formData.status,
        priority: formData.priority,
        start_date: formData.start_date || undefined,
        due_date: formData.due_date || undefined,
        color: formData.color,
        owner: formData.owner || currentUser?.email,
        labels: formData.labels,
      };

      if (isEditMode) {
        await groonabackend.entities.Epic.update(epic.id || epic._id, epicData);
        toast.success('Epic updated successfully!');
      } else {
        epicData.progress = 0;
        const newEpic = await groonabackend.entities.Epic.create(epicData);
        toast.success('Epic created successfully!');

        // Reset form only in create mode
        setFormData({
          name: "",
          description: "",
          status: "planning",
          priority: "medium",
          start_date: "",
          due_date: "",
          color: "#3b82f6",
          owner: currentUser?.email || "",
          labels: [],
        });

        if (onSuccess) onSuccess(newEpic);
      }

      if (isEditMode && onSuccess) {
        onSuccess({ ...epic, ...epicData });
      }
      onClose();
    } catch (error) {
      console.error('Error creating epic:', error);
      toast.error(`Failed to create epic: ${error.message || 'Please try again.'}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            {isEditMode ? 'Edit Epic' : 'Create New Epic'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-purple-500" />
              Epic Name *
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter epic name"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description" className="flex items-center gap-2">
                <AlignLeft className="h-4 w-4 text-slate-600" />
                Description
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateDescription}
                disabled={isGeneratingDescription || !formData.name?.trim()}
                className="text-xs"
              >
                {isGeneratingDescription ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3 w-3 mr-1" />
                    Draft with AI
                  </>
                )}
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <ReactQuill
                theme="snow"
                value={formData.description || ""}
                onChange={(value) => setFormData({ ...formData, description: value })}
                placeholder="Epic description"
                modules={{
                  toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ["bold", "italic", "underline", "strike"],
                    [{ list: "ordered" }, { list: "bullet" }],
                    [{ color: [] }, { background: [] }],
                    ["link", "code-block"],
                    ["clean"],
                  ],
                }}
                style={{ minHeight: "150px" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Circle className="h-4 w-4 text-blue-500" />
                Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-red-500" />
                Priority
              </Label>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date" className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-pink-500" />
                Start Date
              </Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date" className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-pink-500" />
                Due Date
              </Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                min={formData.start_date || new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="color" className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-pink-500" />
              Color
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-16 h-10"
              />
              <Input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="#3b82f6"
                className="flex-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            >
              {isEditMode ? 'Update Epic' : 'Create Epic'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

