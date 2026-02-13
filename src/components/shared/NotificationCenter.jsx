import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell, CheckCircle2, XCircle, AlertCircle, Info, Trash2, UserPlus, MessageSquare, Megaphone, Clock, Search, AlertTriangle, Siren, ShieldAlert, Loader2, Flame,
  AlignLeft,
  Sparkles,
  BatteryLow,
  CalendarDays
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function NotificationCenter({ currentUser }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch task notifications
  const { data: taskNotifications = [] } = useQuery({
    queryKey: ['task-notifications', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      return groonabackend.entities.Notification.filter(
        { recipient_email: currentUser.email },
        '-created_date',
        50
      );
    },
    enabled: !!currentUser?.email,
    refetchInterval: 5000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id) => groonabackend.entities.Notification.update(id, { read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-notifications'] }),
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const promises = taskNotifications.map(n => groonabackend.entities.Notification.delete(n.id));
      await Promise.all(promises);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-notifications'] }),
  });


  // Update notification status (for alerts/alarms)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => groonabackend.entities.Notification.update(id, { status, read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-notifications'] }),
  });

  // Track loading state for individual notifications and actions
  const [loadingState, setLoadingState] = React.useState({ id: null, action: null });

  // Handle alert/alarm actions with navigation
  const handleReview = async (notification) => {
    setLoadingState({ id: notification.id, action: 'review' });
    try {
      // Update status first
      await updateStatusMutation.mutateAsync({ id: notification.id, status: 'ACKNOWLEDGED' });

      // Navigate based on notification type
      if (notification.type === 'timesheet_missing_alert' || notification.type === 'timesheet_incomplete_alert') {
        // Navigate to timesheets log page for timesheet alerts
        navigate('/Timesheets');
        setOpen(false);
      } else if (notification.project_id) {
        // Navigate to project detail for project-related alerts
        let targetUrl = `/ProjectDetail?id=${notification.project_id}`;

        // If there's a specific entity (task, etc.), include it
        if (notification.entity_type === 'task' && notification.entity_id) {
          targetUrl += `&taskId=${notification.entity_id}`;
        }

        navigate(targetUrl);
        setOpen(false);
      }
    } finally {
      setLoadingState({ id: null, action: null });
    }
  };

  const handleDismiss = async (notification) => {
    setLoadingState({ id: notification.id, action: 'dismiss' });
    try {
      await updateStatusMutation.mutateAsync({ id: notification.id, status: 'RESOLVED' });
    } finally {
      setLoadingState({ id: null, action: null });
    }
  };

  const handleTakeAction = async (notification) => {
    setLoadingState({ id: notification.id, action: 'takeAction' });
    try {
      // Update status to ACKNOWLEDGED
      await updateStatusMutation.mutateAsync({ id: notification.id, status: 'ACKNOWLEDGED' });

      // Navigate to relevant context
      if (notification.project_id) {
        let targetUrl = `/ProjectDetail?id=${notification.project_id}`;

        // Include entity details if available
        if (notification.entity_type === 'task' && notification.entity_id) {
          targetUrl += `&taskId=${notification.entity_id}`;
        }

        navigate(targetUrl);
        setOpen(false);
      } else if (notification.type.includes('timesheet') || notification.type === 'user_streak_escalation' || notification.type === 'task_delay_alarm') {
        // Navigate to timesheets for timesheet-related alarms/escalations
        navigate('/Timesheets?tab=alarms');
        setOpen(false);
      }
    } finally {
      setLoadingState({ id: null, action: null });
    }
  };

  // === MOCK DATA FOR ALERTS & ALARMS (For Demonstration) ===
  const mockAlerts = [
    { id: 'm1', type: 'budget_warning', message: '**Budget Warning**: Project "Alpha Revamp" has consumed 85% of budget.', timestamp: new Date().toISOString(), read: false },
    { id: 'm2', type: 'compliance_advisory', message: '**Advisory**: 3 Timesheets pending approval for > 48 hours.', timestamp: new Date(Date.now() - 3600000).toISOString(), read: false },
  ];

  const mockAlarms = [
    { id: 'a1', type: 'security_alert', message: '**Critical**: Unauthorized access attempt detected from IP 192.168.x.x.', timestamp: new Date().toISOString(), read: false, escalationTime: '10 mins' },
    { id: 'a2', type: 'deadline_critical', message: '**Blocking**: "Database Migration" task is overdue and blocking 3 dependencies.', timestamp: new Date(Date.now() - 7200000).toISOString(), read: false, escalationTime: 'Escalated to Admin' },
  ];

  // === CATEGORIZATION LOGIC ===
  // === CATEGORIZATION LOGIC ===
  const categorized = React.useMemo(() => {
    const general = [];
    const alerts = []; // Start empty, rely on backend
    const alarms = [];

    // Combine real notifications with mocks only if needed (for now, let's prefer real)
    // If backend provides 'category', use it.

    console.log('[NotificationCenter] Processing notifications:', taskNotifications.length);

    taskNotifications.forEach(n => {
      // Show alerts/alarms that are OPEN or ACKNOWLEDGED (reviewed)
      // Hide RESOLVED (dismissed) alerts/alarms
      const shouldShow = !n.status || n.status === 'OPEN' || n.status === 'ACKNOWLEDGED';

      if (!shouldShow) return;

      // 0. Priority: Task Delays -> ALERTS (Yellow)
      if (n.type === 'task_delay_alarm') {
        if (shouldShow) alerts.push(n);
      }
      // 1. Critical Alarms -> ALARMS (Red)
      else if (n.category === 'alarm' || n.category === 'critical' || n.type.includes('critical') || n.type.includes('failure') || n.type.includes('security')) {
        if (shouldShow) alarms.push(n);
      }
      // 2. Warnings/Advisories -> ALERTS (Yellow)
      else if (n.category === 'alert' || n.category === 'warning' || n.category === 'advisory' || n.type.includes('warning') || n.type.includes('alert') || n.type.includes('non_billable')) {
        if (shouldShow) alerts.push(n);
      }
      // 3. Fallback -> GENERAL
      else {
        general.push(n);
      }
    });

    return { general, alerts, alarms };
  }, [taskNotifications]);

  // Count only unread notifications that are visible to THIS user
  const allUnreadCount = React.useMemo(() => {
    const generalUnread = categorized.general.filter(n => !n.read).length;
    const alertsUnread = categorized.alerts.filter(n => !n.read).length;
    const alarmsUnread = categorized.alarms.filter(n => !n.read).length;
    return generalUnread + alertsUnread + alarmsUnread;
  }, [categorized]);

  // ... (handleNotificationClick - kept mostly same, handling mocks gracefully)
  const handleNotificationClick = async (notification) => {
    // Mock handling
    if (notification.id.toString().startsWith('m') || notification.id.toString().startsWith('a')) return;

    try {
      // 1. Mark as read
      if (!notification.read) {
        markAsReadMutation.mutate(notification.id);
      }

      // 0. DEEP LINK PRIORITY
      if (notification.deep_link || notification.link) {
        navigate(notification.deep_link || notification.link);
        setOpen(false);
        return;
      }

      // 2. Determine Destination
      // Priority A: We have project_id (New Notifications)
      if (notification.project_id) {
        // ... (rest of function logic) ...

        const getIcon = (type) => {
          switch (type) {
            case 'task_assigned':
            case 'subtask_assignment': return <UserPlus className="h-5 w-5 text-purple-600" />;
            case 'task_completed': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
            case 'comment_added':
            case 'mention': return <MessageSquare className="h-5 w-5 text-blue-600" />;
            case 'timesheet_submission':
            case 'timesheet_approval_needed':
            case 'timesheet_status': return <Clock className="h-5 w-5 text-amber-600" />;
            case 'impediment_reported':
            case 'impediment_alert': return <AlertTriangle className="h-5 w-5 text-red-500" />;
            case 'task_escalation_alert': return <Flame className="h-5 w-5 text-red-600" />;
            case 'multiple_overdue_alarm': return <Siren className="h-5 w-5 text-red-600 animate-pulse" />;
            case 'multiple_overdue_escalation': return <ShieldAlert className="h-5 w-5 text-red-700" />;
            case 'low_workload_alert': return <BatteryLow className="h-5 w-5 text-amber-600" />;
            case 'leave_application': return <CalendarDays className="h-5 w-5 text-blue-500" />;
            case 'leave_approval': return <CalendarDays className="h-5 w-5 text-green-600" />;
            case 'leave_rejection': return <CalendarDays className="h-5 w-5 text-red-500" />;
            case 'leave_cancellation': return <CalendarDays className="h-5 w-5 text-gray-500" />;
            default: return <Bell className="h-5 w-5 text-slate-600" />;
          }
        };
        let targetUrl = `/ProjectDetail?id=${notification.project_id}`;

        // Handle Timesheet Notifications explicitly
        if (notification.type.includes('timesheet') || notification.type === 'user_streak_escalation' || notification.type === 'task_delay_alarm') {
          if (notification.type === 'timesheet_approval_needed') {
            navigate('/Timesheets?tab=approvals');
          } else if (notification.category === 'alarm' || notification.type === 'user_streak_escalation' || notification.type.includes('alarm')) {
            navigate('/Timesheets?tab=alarms');
          } else {
            navigate('/Timesheets?tab=my-timesheets');
          }
          setOpen(false);
          return;
        }

        if (notification.entity_type === 'task') {
          targetUrl += `&taskId=${notification.entity_id}`;
        }

        // For comments/mentions, pass commentId param.
        if (notification.type === 'comment_added' || notification.type === 'mention') {
          // If it is a task comment, we MUST include taskId
          if (notification.entity_type === 'task') {
            targetUrl += `&taskId=${notification.entity_id}`;
          }

          // We append commentId param to allow highlighting
          // Use explicit comment_id if available (from backend/service), otherwise fallback to notification ID if legacy
          const commentId = notification.comment_id || notification.id;
          targetUrl += `&commentId=${commentId}`;
        }

        navigate(targetUrl);
        setOpen(false);
      }
      // Priority B: Fallback for Legacy Notifications
      else {
        // Handle Leave Notifications
        if (notification.entity_type === 'leave' || notification.type.includes('leave')) {
          if (notification.type === 'leave_application') {
            navigate('/PlannedLeaves?tab=approvals');
          } else {
            navigate('/PlannedLeaves?tab=my-leaves');
          }
          setOpen(false);
          return;
        }

        if (notification.entity_type === 'timesheet' || notification.type.includes('timesheet') || notification.type === 'user_streak_escalation' || notification.type === 'task_delay_alarm') {
          if (notification.type === 'timesheet_approval_needed') {
            navigate('/Timesheets?tab=approvals');
          } else if (notification.category === 'alarm' || notification.type === 'user_streak_escalation' || notification.type.includes('alarm')) {
            navigate('/Timesheets?tab=alarms');
          } else {
            navigate('/Timesheets?tab=my-timesheets');
          }
          setOpen(false);
          return;
        }

        if (notification.entity_type === 'task') {
          // Fetch task to get project ID
          try {
            const tasks = await groonabackend.entities.Task.filter({ id: notification.entity_id });
            if (tasks && tasks[0]) {
              const task = tasks[0];
              // Include commentId if available (even if it's notification.id as fallback, though legacy won't match)
              const commentId = notification.comment_id || notification.id;
              navigate(`/ProjectDetail?id=${task.project_id}&taskId=${task.id}&commentId=${commentId}`);
              setOpen(false);
            } else {
              console.warn("Task not found for notification");
            }
          } catch (e) {
            console.error("Error routing to task", e);
          }
        } else if (notification.entity_type === 'project') {
          navigate(`/ProjectDetail?id=${notification.entity_id}`);
          setOpen(false);
        }
      }
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };


  const getIcon = (type) => {
    switch (type) {
      case 'task_assigned': return <UserPlus className="h-5 w-5 text-purple-600" />;
      case 'task_completed': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'comment_added':
      case 'mentiones': return <MessageSquare className="h-5 w-5 text-blue-600" />; // Typo in original? No, "mention"
      case 'mention': return <MessageSquare className="h-5 w-5 text-blue-600" />;
      case 'timesheet_submission':
      case 'timesheet_approval_needed':
      case 'timesheet_status': return <Clock className="h-5 w-5 text-amber-600" />;
      case 'impediment_reported':
      case 'impediment_alert': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default: return <Bell className="h-5 w-5 text-slate-600" />;
    }
  };

  const renderMessage = (text) => {
    if (!text) return null;
    const parts = text.split(/(\*\*[\s\S]*?\*\*)/);
    return parts.map((part, i) => {
      if (part && part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const safeDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return new Date();

      // Clamp future dates to now to prevent "in X hours" due to timezone mismatch
      const now = new Date();
      if (d > now) {
        return now;
      }
      return d;
    } catch (e) {
      return new Date();
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {allUnreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-600 text-white text-xs">
              {allUnreadCount > 9 ? '9+' : allUnreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col h-full">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Notification Center
          </SheetTitle>
          <SheetDescription>You have {allUnreadCount} unread items</SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4 flex-1 flex flex-col min-h-0">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="general" className="text-xs">
              Notifications
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800">
              Alerts ({categorized.alerts.length})
            </TabsTrigger>
            <TabsTrigger value="alarms" className="text-xs data-[state=active]:bg-red-100 data-[state=active]:text-red-800">
              Alarms ({categorized.alarms.length})
            </TabsTrigger>
          </TabsList>

          {/* GENERAL NOTIFICATIONS */}
          <TabsContent value="general" className="grow flex flex-col pt-2 data-[state=inactive]:hidden justify-start h-full min-h-0">
            <div className="flex justify-between items-center mb-2 px-1">
              <h4 className="text-sm font-semibold text-slate-500">General Updates</h4>
              {categorized.general.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => clearAllMutation.mutate()} className="text-xs h-7">
                  Clear All
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1 -mx-4 px-4 h-full">
              {categorized.general.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p>No new notifications</p>
                </div>
              ) : (
                <div className="space-y-3 pb-4">
                  {categorized.general.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${notification.read ? 'bg-slate-50 opacity-60' : 'bg-white border-blue-200'}`}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 mt-1">{getIcon(notification.type)}</div>
                        <div className="flex-1 min-w-0">
                          {/* Only show title if it exists, else rely on message */}
                          {notification.title && <p className="text-sm font-medium text-slate-900">{notification.title}</p>}
                          <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{renderMessage(notification.message)}</p>
                          <p className="text-xs text-slate-400 mt-1">{formatDistanceToNow(safeDate(notification.timestamp || notification.created_date), { addSuffix: true })}</p>
                        </div>
                        {!notification.read && <div className="h-2 w-2 rounded-full bg-blue-600 mt-2 shrink-0" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* ALERTS (WARNINGS) */}
          <TabsContent value="alerts" className="grow flex flex-col pt-2 data-[state=inactive]:hidden justify-start h-full min-h-0">
            <div className="mb-2 px-1"><span className="text-xs font-medium text-amber-600 uppercase tracking-wider">Advisory / Action Needed</span></div>
            <ScrollArea className="flex-1 -mx-4 px-4 h-full">
              {categorized.alerts.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No active alerts</p>
                </div>
              ) : (
                <div className="space-y-3 pb-4">
                  {categorized.alerts.map(alert => {
                    const isActioned = alert.status === 'ACKNOWLEDGED' || alert.status === 'RESOLVED';
                    return (
                      <div key={alert.id} className={`p-4 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors ${isActioned ? 'opacity-60' : ''}`}>
                        <div className="flex gap-3">
                          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                          <div>
                            <h5 className="text-sm font-bold text-amber-800 mb-1">Warning</h5>
                            <p className="text-sm text-amber-900">{alert.message.replace(/\*\*/g, '')}</p>
                            <div className="flex gap-2 mt-2">
                              <Button
                                onClick={() => handleReview(alert)}
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-amber-300 text-amber-700 bg-white hover:bg-amber-50"
                                disabled={loadingState.id === alert.id && loadingState.action === 'review'}
                              >
                                {loadingState.id === alert.id && loadingState.action === 'review' ? (
                                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading...</>
                                ) : 'Review'}
                              </Button>
                              <Button
                                onClick={() => handleDismiss(alert)}
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-200/50"
                                disabled={loadingState.id === alert.id && loadingState.action === 'dismiss'}
                              >
                                {loadingState.id === alert.id && loadingState.action === 'dismiss' ? (
                                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading...</>
                                ) : 'Dismiss'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* ALARMS (CRITICAL) */}
          <TabsContent value="alarms" className="grow flex flex-col pt-2 data-[state=inactive]:hidden justify-start h-full min-h-0">
            <div className="mb-2 px-1"><span className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-2"><Siren className="h-3 w-3 animate-pulse" /> Critical / Blocking</span></div>
            <ScrollArea className="flex-1 -mx-4 px-4 h-full">
              {categorized.alarms.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ShieldAlert className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No critical alarms</p>
                </div>
              ) : (
                <div className="space-y-3 pb-4">
                  {categorized.alarms.map(alarm => {
                    const isActioned = alarm.status === 'ACKNOWLEDGED' || alarm.status === 'RESOLVED';
                    return (
                      <div key={alarm.id} className={`p-4 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-colors shadow-sm relative overflow-hidden ${isActioned ? 'opacity-60' : ''}`}>
                        {/* Escalation Bar */}
                        <div className="absolute top-0 left-0 w-1 bg-red-500 h-full" />

                        <div className="flex gap-3 pl-2">
                          <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <h5 className="text-sm font-bold text-red-800 mb-1">CRITICAL ALARM</h5>
                              <span className="text-[10px] font-mono bg-red-200 text-red-900 px-1.5 py-0.5 rounded">{alarm.escalationTime || 'Auto-Escalating'}</span>
                            </div>
                            <p className="text-sm text-red-900 font-medium">{alarm.message.replace(/\*\*/g, '')}</p>
                            <div className="flex gap-2 mt-3">
                              <Button
                                onClick={() => handleTakeAction(alarm)}
                                size="sm"
                                className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white w-full shadow-red-200"
                                disabled={loadingState.id === alarm.id && loadingState.action === 'takeAction'}
                              >
                                {loadingState.id === alarm.id && loadingState.action === 'takeAction' ? (
                                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Taking Action...</>
                                ) : 'Take Action'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet >
  );
}



