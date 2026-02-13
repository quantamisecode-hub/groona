import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function NotificationStep({ tenant, onNext, onSkip, onBack }) {
  const [preferences, setPreferences] = useState({
    email_notifications: tenant.notification_preferences?.email_notifications ?? true,
    weekly_digest: tenant.notification_preferences?.weekly_digest ?? true,
    project_updates: tenant.notification_preferences?.project_updates ?? true,
    system_announcements: tenant.notification_preferences?.system_announcements ?? true,
  });
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    setLoading(true);
    try {
      await groonabackend.entities.Tenant.update(tenant.id, {
        notification_preferences: preferences,
      });

      toast.success("Notification preferences saved!");
      onNext({ notifications: preferences });
    } catch (error) {
      toast.error("Failed to save preferences");
    } finally {
      setLoading(false);
    }
  };

  const notificationOptions = [
    {
      key: 'email_notifications',
      title: 'Email Notifications',
      description: 'Receive email updates about your projects and tasks',
    },
    {
      key: 'weekly_digest',
      title: 'Weekly Digest',
      description: 'Get a weekly summary of your team\'s activity and progress',
    },
    {
      key: 'project_updates',
      title: 'Project Updates',
      description: 'Be notified when projects you\'re involved in are updated',
    },
    {
      key: 'system_announcements',
      title: 'System Announcements',
      description: 'Receive important updates about new features and improvements',
    },
  ];

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-3">
          <Bell className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Notification Preferences</h2>
        <p className="text-slate-600">
          Choose how you want to stay informed about your workspace activities
        </p>
      </div>

      {/* Notification Options */}
      <div className="space-y-4">
        {notificationOptions.map((option) => (
          <div
            key={option.key}
            className="flex items-start justify-between p-4 border border-slate-200 rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors"
          >
            <div className="flex-1 pr-4">
              <Label className="text-base font-semibold text-slate-900 cursor-pointer">
                {option.title}
              </Label>
              <p className="text-sm text-slate-600 mt-1">
                {option.description}
              </p>
            </div>
            <Switch
              checked={preferences[option.key]}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, [option.key]: checked })
              }
            />
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Bell className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700">
            <p className="font-medium mb-1">You can always change these later</p>
            <p className="text-slate-600">
              These settings apply to the entire workspace. Individual users can customize their own notification preferences in their profile settings.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Continue"
          )}
        </Button>
      </div>
    </div>
  );
}

