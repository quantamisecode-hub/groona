import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Mail, MessageSquare, Calendar, FileText, TrendingUp, Loader2, Save, X, AlertCircle, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export default function NotificationSettings({ user, onUpdate, isUpdating }) {
  const [preferences, setPreferences] = useState({
    email_notifications: true,
    task_assignments: true,
    project_invitations: true,
    comment_mentions: true,
    deadline_reminders: true,
    weekly_summary: true,
    in_app_notifications: true,
    status_updates: true,
    team_activity: true,
  });
  
  const [hasChanges, setHasChanges] = useState(false);
  const [initialPreferences, setInitialPreferences] = useState({});

  // Initialize preferences from user data
  useEffect(() => {
    if (user?.notification_preferences) {
      const prefs = {
        email_notifications: user.notification_preferences.email_notifications ?? true,
        task_assignments: user.notification_preferences.task_assignments ?? true,
        project_invitations: user.notification_preferences.project_invitations ?? true,
        comment_mentions: user.notification_preferences.comment_mentions ?? true,
        deadline_reminders: user.notification_preferences.deadline_reminders ?? true,
        weekly_summary: user.notification_preferences.weekly_summary ?? true,
        in_app_notifications: user.notification_preferences.in_app_notifications ?? true,
        status_updates: user.notification_preferences.status_updates ?? true,
        team_activity: user.notification_preferences.team_activity ?? true,
      };
      setPreferences(prefs);
      setInitialPreferences(prefs);
      setHasChanges(false);
    }
  }, [user?.id]);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(preferences) !== JSON.stringify(initialPreferences);
    setHasChanges(changed);
  }, [preferences, initialPreferences]);

  const handleToggle = (key) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await onUpdate({ notification_preferences: preferences });
      setInitialPreferences(preferences);
      setHasChanges(false);
    } catch (error) {
      console.error('[NotificationSettings] Save error:', error);
      // Error already handled by mutation
    }
  };

  const handleReset = () => {
    setPreferences(initialPreferences);
    setHasChanges(false);
  };

  const notificationOptions = [
    {
      key: "email_notifications",
      label: "Email Notifications",
      description: "Receive notifications via email",
      icon: Mail,
      master: true,
    },
    {
      key: "in_app_notifications",
      label: "In-App Notifications",
      description: "Show notifications within the app",
      icon: Bell,
      master: true,
    },
    {
      key: "task_assignments",
      label: "Task Assignments",
      description: "When you're assigned to a new task",
      icon: FileText,
      category: "Tasks & Projects",
    },
    {
      key: "project_invitations",
      label: "Project Invitations",
      description: "When you're invited to join a project",
      icon: TrendingUp,
      category: "Tasks & Projects",
    },
    {
      key: "status_updates",
      label: "Status Updates",
      description: "When task or project status changes",
      icon: TrendingUp,
      category: "Tasks & Projects",
    },
    {
      key: "comment_mentions",
      label: "Comment Mentions",
      description: "When someone @mentions you in comments",
      icon: MessageSquare,
      category: "Communication",
    },
    {
      key: "team_activity",
      label: "Team Activity",
      description: "Updates about your team's activities",
      icon: TrendingUp,
      category: "Communication",
    },
    {
      key: "deadline_reminders",
      label: "Deadline Reminders",
      description: "Reminders for upcoming task deadlines",
      icon: Calendar,
      category: "Reminders",
    },
    {
      key: "weekly_summary",
      label: "Weekly Summary",
      description: "Weekly digest of your activity and tasks",
      icon: Mail,
      category: "Reminders",
    },
  ];

  const masterOptions = notificationOptions.filter(opt => opt.master);
  const categoryOptions = notificationOptions.filter(opt => !opt.master);
  
  // Group by category
  const groupedOptions = categoryOptions.reduce((acc, option) => {
    const category = option.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(option);
    return acc;
  }, {});

  const allChannelsDisabled = !preferences.email_notifications && !preferences.in_app_notifications;

  return (
    <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-600" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose how and when you want to be notified about important updates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Master Controls */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Notification Channels</h3>
            <div className="space-y-3">
              {masterOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <div
                    key={option.key}
                    className="flex items-center justify-between p-4 rounded-lg border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-blue-50">
                        <Icon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <Label
                          htmlFor={option.key}
                          className="text-sm font-medium text-slate-900 cursor-pointer"
                        >
                          {option.label}
                        </Label>
                        <p className="text-sm text-slate-600 mt-0.5">
                          {option.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={option.key}
                      checked={preferences[option.key]}
                      onCheckedChange={() => handleToggle(option.key)}
                      disabled={isUpdating}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {allChannelsDisabled && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900">
                <strong>Warning:</strong> You have disabled all notification channels. 
                You won't receive any notifications about important updates, assignments, or mentions.
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Detailed Preferences by Category */}
          {Object.entries(groupedOptions).map(([category, options]) => (
            <div key={category} className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">{category}</h3>
              <div className="space-y-2">
                {options.map((option) => {
                  const Icon = option.icon;
                  const isDisabled = allChannelsDisabled || isUpdating;
                  
                  return (
                    <div
                      key={option.key}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        isDisabled
                          ? 'border-slate-100 bg-slate-50/30 opacity-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <Icon className={`h-4 w-4 mt-0.5 ${isDisabled ? 'text-slate-400' : 'text-slate-600'}`} />
                        <div className="flex-1">
                          <Label
                            htmlFor={option.key}
                            className={`text-sm font-medium cursor-pointer ${
                              isDisabled ? 'text-slate-500' : 'text-slate-900'
                            }`}
                          >
                            {option.label}
                          </Label>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {option.description}
                          </p>
                        </div>
                      </div>
                      <Switch
                        id={option.key}
                        checked={preferences[option.key]}
                        onCheckedChange={() => handleToggle(option.key)}
                        disabled={isDisabled}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {hasChanges && (
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <AlertCircle className="h-3 w-3" />
                  Unsaved changes
                </span>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isUpdating || !hasChanges}
              >
                <X className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                type="submit"
                disabled={isUpdating || !hasChanges}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Preferences
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}