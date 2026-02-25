import React from "react";
import { Button } from "@/components/ui/button";
import { Rocket, CheckCircle2, Users, FolderKanban, Sparkles } from "lucide-react";

export default function WelcomeStep({ tenant, user, onNext }) {
  const features = [
    {
      icon: FolderKanban,
      title: "Project Management",
      description: "Create and manage projects with AI-powered insights",
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Invite team members and collaborate in real-time",
    },
    {
      icon: Sparkles,
      title: "AI Assistant",
      description: "Get intelligent suggestions and automate workflows",
    },
    {
      icon: CheckCircle2,
      title: "Task Tracking",
      description: "Track tasks with Kanban boards and sprint planning",
    },
  ];

  return (
    <div className="space-y-8 py-4">
      {/* Welcome Message */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
          <Rocket className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
          Welcome to Groona!
        </h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Hi {user.full_name}! We're excited to have you on board. Let's take a quick tour to help you get started with your new workspace.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
        {features.map((feature, index) => (
          <div
            key={index}
            className="flex gap-4 p-4 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
          >
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <feature.icon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 mb-1">{feature.title}</h3>
              <p className="text-sm text-slate-600">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Subscription Info */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <CheckCircle2 className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 mb-2">
              Your Free Trial Plan
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
              <div>
                <p className="text-slate-600">Team Size</p>
                <p className="font-semibold text-slate-900">Up to {tenant.max_users || 10} users</p>
              </div>
              <div>
                <p className="text-slate-600">Projects</p>
                <p className="font-semibold text-slate-900">Up to {tenant.max_projects || 20} projects</p>
              </div>
              <div>
                <p className="text-slate-600">Storage</p>
                <p className="font-semibold text-slate-900">{tenant.max_storage_gb || 5} GB</p>
              </div>
            </div>
            {/* Always show trial period for new tenants */}
            {(() => {
              // Calculate trial end date (14 days from now or use existing trial_ends_at)
              let trialEndDate;
              if (tenant.trial_ends_at) {
                trialEndDate = new Date(tenant.trial_ends_at);
              } else {
                // If no trial_ends_at, calculate 14 days from now
                const now = new Date();
                trialEndDate = new Date(now);
                trialEndDate.setDate(now.getDate() + 14);
              }
              
              return (
                <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
                  <p className="text-sm font-semibold text-slate-900 mb-1">
                    🎉 Free Trial Period: 14 Days
                  </p>
                  <p className="text-sm text-amber-700">
                    ⏰ Your free trial expires on {trialEndDate.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-center pt-4">
        <Button
          onClick={() => onNext({})}
          size="lg"
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8"
        >
          Let's Get Started
          <Rocket className="h-5 w-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}