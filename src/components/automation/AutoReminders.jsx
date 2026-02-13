import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Send, CheckCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { differenceInDays } from "date-fns";

export default function AutoReminders({ currentUser }) {
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState(null);

  // CRITICAL FIX: Determine effective tenant ID
  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
    ? currentUser.active_tenant_id 
    : currentUser?.tenant_id;

  const { data: tasks = [] } = useQuery({
    queryKey: ['all-tasks', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Task.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!currentUser && !!effectiveTenantId,
  });

  const createNotificationMutation = useMutation({
    mutationFn: (data) => groonabackend.entities.Notification.create(data),
  });

  const sendReminders = async () => {
    setIsSending(true);
    setResult(null);

    try {
      const now = new Date();
      const reminders = [];

      // Find tasks that need reminders
      const tasksNeedingReminders = tasks.filter(task => {
        if (!task.due_date || task.status === 'completed' || !task.assigned_to) return false;
        
        const dueDate = new Date(task.due_date);
        const daysUntilDue = differenceInDays(dueDate, now);
        
        // Send reminder if:
        // 1. Due in 3 days or less (and not overdue)
        // 2. Overdue
        return (daysUntilDue >= 0 && daysUntilDue <= 3) || daysUntilDue < 0;
      });

      for (const task of tasksNeedingReminders) {
        const dueDate = new Date(task.due_date);
        const daysUntilDue = differenceInDays(dueDate, now);
        
        let message;
        if (daysUntilDue < 0) {
          message = `Task "${task.title}" is ${Math.abs(daysUntilDue)} day(s) overdue!`;
        } else if (daysUntilDue === 0) {
          message = `Task "${task.title}" is due today!`;
        } else {
          message = `Task "${task.title}" is due in ${daysUntilDue} day(s).`;
        }

        // Handle both array and string assigned_to
        const assignees = Array.isArray(task.assigned_to) 
          ? task.assigned_to 
          : (task.assigned_to ? [task.assigned_to] : []);

        // Send notification to each assignee
        for (const assigneeEmail of assignees) {
          await createNotificationMutation.mutateAsync({
            tenant_id: effectiveTenantId,
            recipient_email: assigneeEmail,
            type: daysUntilDue < 0 ? "task_completed" : "task_assigned",
            title: daysUntilDue < 0 ? "Overdue Task" : "Upcoming Deadline",
            message,
            entity_type: "task",
            entity_id: task.id,
            sender_name: "Reminder System",
          });

          reminders.push({
            task: task.title,
            assignee: assigneeEmail,
            daysUntilDue,
          });
        }
      }

      setResult({
        success: true,
        message: `Sent ${reminders.length} reminder(s) successfully.`,
        reminders,
      });

    } catch (error) {
      console.error('Error sending reminders:', error);
      setResult({ 
        success: false, 
        message: "Error sending reminders. Please try again.",
        reminders: []
      });
    }

    setIsSending(false);
  };

  const upcomingDeadlines = tasks.filter(task => {
    if (!task.due_date || task.status === 'completed') return false;
    const daysUntilDue = differenceInDays(new Date(task.due_date), new Date());
    return daysUntilDue >= 0 && daysUntilDue <= 7;
  });

  const overdueTasks = tasks.filter(task => {
    if (!task.due_date || task.status === 'completed') return false;
    return differenceInDays(new Date(task.due_date), new Date()) < 0;
  });

  return (
    <div className="space-y-6">
      <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-violet-600" />
            Automated Reminders
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-blue-50 border-blue-200">
            <Bell className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              Send automated reminders for upcoming deadlines and overdue tasks to assigned team members.
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-red-50 border border-red-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <Bell className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Overdue Tasks</p>
                  <p className="text-3xl font-bold text-red-600">{overdueTasks.length}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                Tasks past their due date
              </p>
            </div>

            <div className="p-6 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Bell className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Due This Week</p>
                  <p className="text-3xl font-bold text-amber-600">{upcomingDeadlines.length}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                Tasks due within 7 days
              </p>
            </div>
          </div>

          <Button
            onClick={sendReminders}
            disabled={isSending || (overdueTasks.length === 0 && upcomingDeadlines.length === 0)}
            className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending Reminders...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Reminders Now
              </>
            )}
          </Button>

          {result && (
            <Alert className={result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
              <CheckCircle className={`h-4 w-4 ${result.success ? "text-green-600" : "text-red-600"}`} />
              <AlertDescription className={result.success ? "text-green-900" : "text-red-900"}>
                <p className="font-semibold mb-2">{result.message}</p>
                {result.reminders.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {result.reminders.map((reminder, index) => (
                      <div key={index} className="text-sm p-2 bg-white rounded border border-green-200">
                        <p><strong>{reminder.task}</strong></p>
                        <p className="text-xs text-slate-600 mt-1">
                          To: {reminder.assignee} • 
                          {reminder.daysUntilDue < 0 
                            ? ` ${Math.abs(reminder.daysUntilDue)} days overdue`
                            : reminder.daysUntilDue === 0
                            ? ' Due today'
                            : ` Due in ${reminder.daysUntilDue} days`
                          }
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <h4 className="font-semibold text-slate-900 mb-3">Reminder Schedule</h4>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Reminders sent for tasks due within 3 days</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Urgent reminders for overdue tasks</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Notifications sent to assigned team members only</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

