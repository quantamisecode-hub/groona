import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Folder, Loader2, Palette } from "lucide-react";

export default function EditWorkspaceDialog({ open, onClose, onSubmit, loading, workspace }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "blue",
  });

  useEffect(() => {
    if (workspace && open) {
      setFormData({
        name: workspace.name || "",
        description: workspace.description || "",
        color: workspace.color || "blue",
      });
    }
  }, [workspace, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleClose = () => {
    onClose();
  };

  const colors = [
    { value: "blue", label: "Blue", class: "bg-blue-100 border border-blue-200" },
    { value: "green", label: "Green", class: "bg-emerald-100 border border-emerald-200" },
    { value: "purple", label: "Purple", class: "bg-purple-100 border border-purple-200" },
    { value: "orange", label: "Orange", class: "bg-orange-100 border border-orange-200" },
    { value: "red", label: "Red", class: "bg-rose-100 border border-rose-200" },
    { value: "indigo", label: "Indigo", class: "bg-indigo-100 border border-indigo-200" },
    { value: "teal", label: "Teal", class: "bg-teal-100 border border-teal-200" },
    { value: "pink", label: "Pink", class: "bg-pink-100 border border-pink-200" },
  ];

  const selectedColor = colors.find(c => c.value === formData.color);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-900">
            <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
              <Folder className="h-4 w-4 text-zinc-700" strokeWidth={1.5} />
            </div>
            Edit Workspace
          </DialogTitle>
          <DialogDescription className="text-zinc-500 mt-1">
            Update your workspace details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Workspace Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Marketing Team, Development, Design"
              required
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What is this workspace for?"
              rows={3}
              disabled={loading}
            />
          </div>

          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Palette className="h-4 w-4" />
              Color Theme
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {colors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  disabled={loading}
                  className={`h-12 rounded-xl ${color.class} transition-all ${formData.color === color.value
                      ? 'ring-2 ring-zinc-900 ring-offset-2 scale-105 shadow-sm'
                      : 'opacity-60 hover:opacity-100 hover:scale-105'
                    }`}
                  title={color.label}
                />
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-2 font-medium tracking-wide">
              Selected: <span className="text-zinc-800">{selectedColor?.label}</span>
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 mt-6">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading} className="rounded-lg shadow-sm border-zinc-200">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg shadow-sm transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}