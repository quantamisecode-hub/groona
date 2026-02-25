import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Folder, Loader2, Palette } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CreateWorkspaceDialog({ open, onClose, onSubmit, loading, workspaceLimit, currentCount }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "blue",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleClose = () => {
    setFormData({ name: "", description: "", color: "blue" });
    onClose();
  };

  const colors = [
    { value: "blue", label: "Blue", class: "bg-gradient-to-br from-blue-500 to-cyan-500" },
    { value: "green", label: "Green", class: "bg-gradient-to-br from-green-500 to-emerald-500" },
    { value: "purple", label: "Purple", class: "bg-gradient-to-br from-purple-500 to-pink-500" },
    { value: "orange", label: "Orange", class: "bg-gradient-to-br from-orange-500 to-amber-500" },
    { value: "red", label: "Red", class: "bg-gradient-to-br from-red-500 to-rose-500" },
    { value: "indigo", label: "Indigo", class: "bg-gradient-to-br from-indigo-500 to-purple-500" },
    { value: "teal", label: "Teal", class: "bg-gradient-to-br from-teal-500 to-cyan-500" },
    { value: "pink", label: "Pink", class: "bg-gradient-to-br from-pink-500 to-rose-500" },
  ];

  const selectedColor = colors.find(c => c.value === formData.color);
  const limitReached = workspaceLimit && currentCount >= workspaceLimit;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-blue-600" />
            Create New Workspace
          </DialogTitle>
          <DialogDescription>
            Organize your projects into separate workspaces for better management
          </DialogDescription>
        </DialogHeader>

        {limitReached && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertDescription className="text-amber-900 text-sm">
              <strong>Limit Reached:</strong> You've reached your workspace limit ({workspaceLimit}). 
              Upgrade your plan to create more workspaces.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Workspace Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Marketing Team, Development, Design"
              required
              disabled={loading || limitReached}
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
              disabled={loading || limitReached}
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
                  disabled={loading || limitReached}
                  className={`h-12 rounded-lg ${color.class} transition-all ${
                    formData.color === color.value 
                      ? 'ring-2 ring-slate-900 ring-offset-2 scale-105' 
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  title={color.label}
                />
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Selected: <span className="font-medium">{selectedColor?.label}</span>
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.name.trim() || limitReached}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Workspace'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}