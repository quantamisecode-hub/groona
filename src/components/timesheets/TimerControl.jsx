import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { groonabackend } from "@/api/groonabackend";

export default function TimerControl({ task, onTimerStop }) {
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isStopping, setIsStopping] = useState(false);

  useEffect(() => {
    // Check if there's an active timer for this task
    const timerKey = `timer_${task.id}`;
    const savedTimer = localStorage.getItem(timerKey);
    if (savedTimer) {
      const { start } = JSON.parse(savedTimer);
      setStartTime(start);
      setIsRunning(true);
    }
  }, [task.id]);

  useEffect(() => {
    let interval;
    if (isRunning && startTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsedSeconds(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    const now = Date.now();
    setStartTime(now);
    setIsRunning(true);

    const timerKey = `timer_${task.id}`;
    localStorage.setItem(timerKey, JSON.stringify({
      start: now,
      task_id: task.id,
      task_title: task.title,
      project_id: task.project_id,
      sprint_id: task.sprint_id
    }));

    toast.success(`Timer started for: ${task.title}`);
  };

  const handlePause = () => {
    setIsRunning(false);
    const timerKey = `timer_${task.id}`;
    localStorage.removeItem(timerKey);
    toast.info('Timer paused');
  };

  const handleStop = async () => {
    if (!startTime) return;

    setIsStopping(true);
    try {
      const user = await groonabackend.auth.me();
      const totalMinutes = Math.floor(elapsedSeconds / 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      // Get tenant ID properly
      const effectiveTenantId = user.is_super_admin && user.active_tenant_id
        ? user.active_tenant_id
        : user.tenant_id;

      // Get location if enabled
      let locationData = null;
      try {
        const settings = await groonabackend.entities.TenantTimesheetSettings.filter({
          tenant_id: effectiveTenantId
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
        console.log('[TimerControl] Location capture failed:', error);
      }

      // Create draft timesheet entry
      await groonabackend.entities.Timesheet.create({
        tenant_id: effectiveTenantId,
        user_email: user.email,
        user_name: user.full_name,
        task_id: task.id,
        task_title: task.title,
        project_id: task.project_id,
        project_name: task.project_name,
        sprint_id: task.sprint_id || null,
        sprint_name: task.sprint_name || null,
        date: new Date().toISOString().split('T')[0],
        hours,
        minutes,
        total_minutes: totalMinutes,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date().toISOString(),
        entry_type: 'timer',
        work_type: 'development',
        status: 'draft',
        location: locationData,
        is_billable: true,
        is_locked: false
      });

      // Clear timer
      const timerKey = `timer_${task.id}`;
      localStorage.removeItem(timerKey);

      setIsRunning(false);
      setStartTime(null);
      setElapsedSeconds(0);

      toast.success(`Time logged: ${hours}h ${minutes}m`);

      if (onTimerStop) onTimerStop();
    } catch (error) {
      console.error('[TimerControl] Error stopping timer:', error);
      toast.error('Failed to save time entry');
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isRunning ? (
        <>
          <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 font-mono text-sm">
            <Clock className="h-3 w-3 animate-pulse" />
            {formatTime(elapsedSeconds)}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePause}
            disabled={isStopping}
            className="h-8"
          >
            <Pause className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleStop}
            disabled={isStopping}
            className="h-8"
          >
            {isStopping ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Square className="h-3 w-3" />
            )}
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={handleStart}
          className="h-8"
        >
          <Play className="h-3 w-3 mr-1" />
          Start Timer
        </Button>
      )}
    </div>
  );
}

