import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Bell, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function NotificationPreferences({ currentUser }) {
  const [preferences, setPreferences] = useState({
    task_assigned: true,
    task_completed: true,
    task_due_soon: true,
    comment_added: true,
    mention: true,
    project_updated: true,
    milestone_updated: true,
    email_notifications: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, [currentUser]);

  const loadPreferences = async () => {
    try {
      const userData = await groonabackend.auth.me();
      if (userData.notification_preferences) {
        setPreferences({ ...preferences, ...userData.notification_preferences });
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferencesMutation = useMutation({
    mutationFn: async (newPreferences) => {
      await groonabackend.auth.updateMe({
        notification_preferences: newPreferences
      });
    },
    onSuccess: () => {
      toast.success('Notification preferences saved');
    },
    onError: (error) => {
      toast.error('Failed to save preferences');
      console.error(error);
    },
  });

  const handleToggle = (key) => {
    const newPreferences = { ...preferences, [key]: !preferences[key] };
    setPreferences(newPreferences);
  };

  const handleSave = () => {
    savePreferencesMutation.mutate(preferences);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-600" />
          <CardTitle>Notification Preferences</CardTitle>
        </div>
        <CardDescription>
          Choose what notifications you want to receive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="task_assigned" className="font-medium">Task Assignments</Label>
              <p className="text-sm text-slate-500">When a task is assigned to you</p>
            </div>
            <Switch
              id="task_assigned"
              checked={preferences.task_assigned}
              onCheckedChange={() => handleToggle('task_assigned')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="task_completed" className="font-medium">Task Completions</Label>
              <p className="text-sm text-slate-500">When a task you're involved in is completed</p>
            </div>
            <Switch
              id="task_completed"
              checked={preferences.task_completed}
              onCheckedChange={() => handleToggle('task_completed')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="task_due_soon" className="font-medium">Upcoming Deadlines</Label>
              <p className="text-sm text-slate-500">When a task deadline is approaching</p>
            </div>
            <Switch
              id="task_due_soon"
              checked={preferences.task_due_soon}
              onCheckedChange={() => handleToggle('task_due_soon')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="comment_added" className="font-medium">New Comments</Label>
              <p className="text-sm text-slate-500">When someone comments on your tasks or projects</p>
            </div>
            <Switch
              id="comment_added"
              checked={preferences.comment_added}
              onCheckedChange={() => handleToggle('comment_added')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="mention" className="font-medium">Mentions</Label>
              <p className="text-sm text-slate-500">When someone mentions you in a comment</p>
            </div>
            <Switch
              id="mention"
              checked={preferences.mention}
              onCheckedChange={() => handleToggle('mention')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="project_updated" className="font-medium">Project Updates</Label>
              <p className="text-sm text-slate-500">When project status or details change</p>
            </div>
            <Switch
              id="project_updated"
              checked={preferences.project_updated}
              onCheckedChange={() => handleToggle('project_updated')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="milestone_updated" className="font-medium">Milestone Updates</Label>
              <p className="text-sm text-slate-500">When project milestones are updated or completed</p>
            </div>
            <Switch
              id="milestone_updated"
              checked={preferences.milestone_updated}
              onCheckedChange={() => handleToggle('milestone_updated')}
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email_notifications" className="font-medium">Email Notifications</Label>
                <p className="text-sm text-slate-500">Receive notifications via email</p>
              </div>
              <Switch
                id="email_notifications"
                checked={preferences.email_notifications}
                onCheckedChange={() => handleToggle('email_notifications')}
              />
            </div>
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={savePreferencesMutation.isPending}
          className="w-full"
        >
          {savePreferencesMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Save Preferences
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

