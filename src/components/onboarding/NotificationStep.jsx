import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
      title: 'Activity Alerts',
      description: 'Instant updates on project tasks and progress.',
    },
    {
      key: 'weekly_digest',
      title: 'Weekly Summary',
      description: 'A curated overview of your team\'s performance.',
    },
    {
      key: 'project_updates',
      title: 'Project Insights',
      description: 'Critical updates on roadmaps and milestones.',
    },
    {
      key: 'system_announcements',
      title: 'New Features',
      description: 'Stay ahead with the latest tools and improvements.',
    },
  ];

  return (
    <div className="w-full space-y-12">
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
          Stay <span className="text-blue-600">informed.</span>
        </h2>
        <p className="text-slate-500 text-xl max-w-2xl">
          Control how and when you receive updates. These settings determine the baseline for your workspace.
        </p>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          {notificationOptions.map((option, index) => (
            <motion.div
              key={option.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + (index * 0.05) }}
              className="flex items-center justify-between p-6 rounded-2xl border border-slate-100 bg-white hover:border-blue-100 hover:shadow-sm transition-all group"
            >
              <div className="space-y-1 pr-4">
                <Label className="text-lg font-bold text-slate-900 cursor-pointer">
                  {option.title}
                </Label>
                <p className="text-sm text-slate-400 group-hover:text-slate-500 transition-colors leading-snug">
                  {option.description}
                </p>
              </div>
              <Switch
                checked={preferences[option.key]}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, [option.key]: checked })
                }
                className="data-[state=checked]:bg-blue-600 scale-110"
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Informational Sidepanel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          <div className="p-8 rounded-3xl bg-slate-950 text-white space-y-6 relative overflow-hidden">
            <div className="relative z-10 w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mb-6">
              <Bell className="w-6 h-6" />
            </div>
            <div className="relative z-10 space-y-2">
              <h3 className="font-bold text-xl">Smart Alerts System</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Groona uses AI to detect project risks and team burnout. These critical alerts are always prioritized to ensure your team's health.
              </p>
            </div>
            <div className="relative z-10 space-y-4 pt-4 border-t border-white/10 text-xs text-slate-400">
              <p className="flex gap-2">
                <span className="text-blue-500 font-bold">•</span>
                <span>Customizable per-user after onboarding</span>
              </p>
              <p className="flex gap-2">
                <span className="text-blue-500 font-bold">•</span>
                <span>Integrates with Slack and Teams</span>
              </p>
            </div>
            {/* Abs decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          </div>

          <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <p className="text-xs font-medium text-slate-600">
              We respect your focus. Non-critical notifications are batched to reduce workspace noise.
            </p>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="pt-8 border-t border-slate-100 flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="text-slate-400 hover:text-slate-900 font-bold">
            Previous
          </Button>
          <Button variant="ghost" onClick={() => onNext({ notifications: preferences })} className="text-slate-400 hover:text-slate-900 font-bold">
            Skip
          </Button>
          <Button
            onClick={handleNext}
            disabled={loading}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-10 h-14 font-semibold group flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Finish Setup <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

