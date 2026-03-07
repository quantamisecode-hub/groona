import React, { useState, useMemo } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

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

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => groonabackend.auth.me(),
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', user?.tenant_id],
    queryFn: () => groonabackend.entities.Holiday.filter({
      tenant_id: user.tenant_id
    }),
    enabled: !!user?.tenant_id,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Fetch this employee's work schedule from the dedicated DB table
  const { data: employeeSchedule } = useQuery({
    queryKey: ['employee-work-schedules', user?.tenant_id, user?.email],
    queryFn: async () => {
      const results = await groonabackend.entities.EmployeeWorkSchedule.filter({
        tenant_id: user.tenant_id,
        user_email: user.email
      });
      return results[0] || null;
    },
    enabled: !!user?.tenant_id && !!user?.email,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Derive working days: DB schedule → user model → Mon-Sat default
  const userWorkingDays = useMemo(() => {
    if (employeeSchedule?.working_days?.length) return employeeSchedule.working_days;
    if (user?.working_days?.length) return user.working_days;
    return [1, 2, 3, 4, 5, 6];
  }, [employeeSchedule, user]);

  const holidayList = useMemo(() => {
    const list = new Set();
    const currentYear = new Date().getFullYear();

    const getHolidays = (year) => {
      const holidayData = {
        2025: [{ m: 0, d: 26 }, { m: 1, d: 26 }, { m: 2, d: 14 }, { m: 2, d: 31 }, { m: 3, d: 6 }, { m: 3, d: 10 }, { m: 3, d: 18 }, { m: 4, d: 12 }, { m: 5, d: 7 }, { m: 6, d: 6 }, { m: 7, d: 15 }, { m: 7, d: 16 }, { m: 8, d: 5 }, { m: 9, d: 2 }, { m: 9, d: 2 }, { m: 9, d: 20 }, { m: 10, d: 5 }, { m: 11, d: 25 }],
        2026: [{ m: 0, d: 26 }, { m: 2, d: 4 }, { m: 2, d: 21 }, { m: 2, d: 26 }, { m: 2, d: 31 }, { m: 3, d: 3 }, { m: 4, d: 1 }, { m: 4, d: 27 }, { m: 5, d: 26 }, { m: 7, d: 15 }, { m: 7, d: 26 }, { m: 8, d: 4 }, { m: 9, d: 2 }, { m: 9, d: 20 }, { m: 10, d: 8 }, { m: 10, d: 24 }, { m: 11, d: 25 }],
        2027: [{ m: 0, d: 26 }, { m: 2, d: 10 }, { m: 2, d: 22 }, { m: 2, d: 25 }, { m: 3, d: 15 }, { m: 3, d: 20 }, { m: 4, d: 17 }, { m: 4, d: 20 }, { m: 6, d: 16 }, { m: 7, d: 15 }, { m: 7, d: 16 }, { m: 7, d: 25 }, { m: 9, d: 2 }, { m: 9, d: 10 }, { m: 9, d: 29 }, { m: 10, d: 14 }, { m: 11, d: 25 }]
      };
      return holidayData[year] || [];
    };

    [currentYear - 1, currentYear, currentYear + 1].forEach(year => {
      getHolidays(year).forEach(h => {
        list.add(format(new Date(year, h.m, h.d), 'yyyy-MM-dd'));
      });
    });

    holidays.forEach(h => {
      if (h.date) {
        const dbDate = typeof h.date === 'string' ? h.date.split('T')[0] : format(new Date(h.date), 'yyyy-MM-dd');
        list.add(dbDate);
      }
    });

    return list;
  }, [holidays]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Holiday & Working Days Validation
    const selectedDate = new Date(formData.date);
    const dayOfWeek = selectedDate.getDay();

    if (!userWorkingDays.includes(dayOfWeek)) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      toast.error(`You cannot log time on a ${dayNames[dayOfWeek]} (Non-working day).`);
      return;
    }
    if (holidayList.has(formData.date)) {
      toast.error("You cannot log time on a holiday.");
      return;
    }

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
                <SelectItem value="impediment">Impediment</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="idle">Idle</SelectItem>
                <SelectItem value="overtime">Overtime</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Remark for Quick Entry */}
          {(formData.work_type === 'rework' || formData.work_type === 'bug' || formData.work_type === 'overtime' || formData.work_type === 'impediment') && (
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

