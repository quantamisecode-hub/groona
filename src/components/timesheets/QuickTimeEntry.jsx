import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { groonabackend } from "@/api/groonabackend";

export default function QuickTimeEntry({ open, onClose, task, onSuccess }) {
  const [formData, setFormData] = useState({
    hours: 0,
    minutes: 0,
    description: "",
    remark: "",
    work_type: "development",
    date: new Date().toISOString().split('T')[0]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.hours === 0 && formData.minutes === 0) {
      toast.error('Please enter time spent');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await groonabackend.auth.me();
      const totalMinutes = (formData.hours * 60) + formData.minutes;

      // Get location if enabled
      let locationData = null;
      try {
        const settings = await groonabackend.entities.TenantTimesheetSettings.filter({
          tenant_id: user.tenant_id
        });

        if (settings[0]?.location_tracking !== 'off' && navigator.geolocation) {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });

          locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            captured_at: new Date().toISOString(),
            precision: settings[0].location_tracking
          };
        }
      } catch (error) {
        console.log('[QuickTimeEntry] Location capture failed:', error);
      }

      await groonabackend.entities.Timesheet.create({
        tenant_id: user.tenant_id,
        user_email: user.email,
        user_name: user.full_name,
        task_id: task.id,
        task_title: task.title,
        project_id: task.project_id,
        project_name: task.project_name,
        sprint_id: task.sprint_id || null,
        sprint_name: task.sprint_name || null,
        date: formData.date,
        hours: formData.hours,
        minutes: formData.minutes,
        total_minutes: totalMinutes,
        time_spent: `${formData.hours.toString().padStart(2, '0')}:${formData.minutes.toString().padStart(2, '0')}`,
        description: formData.description,
        remark: formData.remark,
        work_type: formData.work_type,
        entry_type: 'manual',
        status: 'draft',
        location: locationData,
        is_billable: true,
        is_locked: false
      });

      toast.success('Time entry created');
      onSuccess?.();
      onClose();
      setFormData({
        hours: 0,
        minutes: 0,
        description: "",
        remark: "",
        work_type: "development",
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('[QuickTimeEntry] Error:', error);
      toast.error('Failed to create time entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Time</DialogTitle>
          <p className="text-sm text-slate-600 mt-1">{task?.title}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hours</Label>
              <Input
                type="number"
                min="0"
                max="24"
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: parseInt(e.target.value) || 0 })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label>Minutes</Label>
              <Input
                type="number"
                min="0"
                max="59"
                step="15"
                value={formData.minutes}
                onChange={(e) => setFormData({ ...formData, minutes: parseInt(e.target.value) || 0 })}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Work Type</Label>
            <Select
              value={formData.work_type}
              onValueChange={(value) => setFormData({ ...formData, work_type: value })}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="development">Development</SelectItem>
                <SelectItem value="qa">QA</SelectItem>
                <SelectItem value="rework">Rework</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="idle">Idle</SelectItem>
                <SelectItem value="overtime">Overtime</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Remark for Quick Entry */}
          {(formData.work_type === 'rework' || formData.work_type === 'bug' || formData.work_type === 'overtime') && (
            <div className="space-y-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Label className="text-amber-900 font-semibold italic text-xs">
                Remark (Mandatory) *
              </Label>
              <Input
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                placeholder="Reason..."
                className="h-8 text-sm"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What did you work on?"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Draft'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

