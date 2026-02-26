import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Rocket, FolderKanban, Users, Palette, Bell, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function CompletionStep({ data, onComplete, onBack }) {
  const completedSteps = [
    {
      icon: FolderKanban,
      title: "Projects",
      completed: data.projects?.length > 0,
      count: data.projects?.length || 0,
    },
    {
      icon: Users,
      title: "Team",
      completed: data.invites?.length > 0,
      count: data.invites?.length || 0,
    },
    {
      icon: Palette,
      title: "Identity",
      completed: data.branding?.logo_url || data.branding?.primary_color,
      count: null,
    },
    {
      icon: Bell,
      title: "Settings",
      completed: data.notifications && Object.keys(data.notifications).length > 0,
      count: null,
    },
  ];

  return (
    <div className="w-full space-y-16">
      {/* Celebratory Header */}
      <div className="space-y-6">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/20"
        >
          <Rocket className="h-8 w-8" />
        </motion.div>

        <div className="space-y-3">
          <h2 className="text-5xl md:text-6xl font-bold text-slate-900 tracking-tight leading-tight">
            Mission Ready.
          </h2>
          <p className="text-slate-500 text-xl max-w-2xl">
            Your workspace is configured and the environment is optimized for your team's success.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch">
        {/* Hero Action Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="p-10 md:p-12 rounded-[2.5rem] bg-slate-900 text-white shadow-2xl space-y-8 relative overflow-hidden group flex flex-col justify-between"
        >
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-4 border border-blue-500/30">
              <Sparkles className="w-4 h-4" />
              AI Deployment Active
            </div>
            <h3 className="text-3xl font-bold">Launch your first sprint</h3>
            <p className="text-slate-400 text-lg leading-relaxed max-w-sm">
              Everything is set up. Head to your dashboard to start organizing tasks and tracking progress with real-time AI insights.
            </p>
          </div>

          <div className="relative z-10">
            <Button
              onClick={onComplete}
              size="lg"
              className="w-full h-16 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-bold text-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 shadow-xl"
            >
              Enter Dashboard
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
        </motion.div>

        {/* Status Checklist Column */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-6 flex flex-col justify-center"
        >
          <div className="p-8 rounded-3xl border border-slate-100 bg-white shadow-sm space-y-8">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Setup Summary</h4>
            <div className="grid grid-cols-1 gap-6">
              {completedSteps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + (index * 0.1) }}
                  className="flex items-center gap-5 group"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${step.completed ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-300'
                    }`}>
                    {step.completed ? <CheckCircle2 className="w-6 h-6" /> : <step.icon className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 border-b border-slate-50 pb-4 group-last:border-0">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${step.completed ? 'text-slate-900' : 'text-slate-400 font-medium'}`}>
                        {step.title}
                      </span>
                      {step.count > 0 && (
                        <span className="text-xs font-bold bg-slate-950 text-white px-2 py-0.5 rounded-md">
                          {step.count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      {step.completed ? 'Successfully configured' : 'Skipped during setup'}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="text-center pt-4">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-slate-900 text-sm font-bold transition-colors underline-offset-4 hover:underline"
            >
              ← Return to setup details
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}