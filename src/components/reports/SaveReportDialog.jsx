import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

export default function SaveReportDialog({ open, onClose, onSave, loading }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    report_type: 'custom',
    is_favorite: false,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      report_type: 'custom',
      is_favorite: false,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Save Report Configuration</DialogTitle>
          <DialogDescription>
            Save your current filters and visualization settings for quick access later
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Report Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Monthly Billing Report"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this report shows..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Report Type</Label>
            <Select 
              value={formData.report_type} 
              onValueChange={(val) => setFormData({ ...formData, report_type: val })}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="timesheet">Timesheet Report</SelectItem>
                <SelectItem value="project">Project Report</SelectItem>
                <SelectItem value="productivity">Productivity Report</SelectItem>
                <SelectItem value="billing">Billing Report</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="favorite"
              checked={formData.is_favorite}
              onCheckedChange={(checked) => setFormData({ ...formData, is_favorite: checked })}
            />
            <Label htmlFor="favorite" className="cursor-pointer">
              Mark as favorite
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="bg-gradient-to-r from-blue-500 to-purple-600"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}