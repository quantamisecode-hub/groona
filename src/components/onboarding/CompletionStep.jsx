import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Rocket, FolderKanban, Users, Palette, Bell } from "lucide-react";

export default function CompletionStep({ data, onComplete, onBack }) {
  const completedSteps = [
    {
      icon: FolderKanban,
      title: "Projects Created",
      completed: data.projects?.length > 0,
      count: data.projects?.length || 0,
    },
    {
      icon: Users,
      title: "Team Invites Sent",
      completed: data.invites?.length > 0,
      count: data.invites?.length || 0,
    },
    {
      icon: Palette,
      title: "Branding Configured",
      completed: data.branding?.logo_url || data.branding?.primary_color,
      count: null,
    },
    {
      icon: Bell,
      title: "Notifications Set",
      completed: data.notifications && Object.keys(data.notifications).length > 0,
      count: null,
    },
  ];

  const completedCount = completedSteps.filter(s => s.completed).length;

  return (
    <div className="space-y-8 py-4">
      {/* Success Icon */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 mb-4">
          <CheckCircle2 className="h-14 w-14 text-white" />
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
          You're All Set! 🎉
        </h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Your workspace is ready to go. You've completed {completedCount} of {completedSteps.length} setup steps.
        </p>
      </div>

      {/* Completed Steps Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {completedSteps.map((step, index) => (
          <div
            key={index}
            className={`flex items-start gap-4 p-4 rounded-lg border transition-all ${
              step.completed
                ? 'bg-green-50 border-green-200'
                : 'bg-slate-50 border-slate-200 opacity-60'
            }`}
          >
            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
              step.completed
                ? 'bg-green-500'
                : 'bg-slate-300'
            }`}>
              {step.completed ? (
                <CheckCircle2 className="h-5 w-5 text-white" />
              ) : (
                <step.icon className="h-5 w-5 text-white" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">{step.title}</h3>
              {step.completed && step.count !== null && (
                <p className="text-sm text-slate-600 mt-1">
                  {step.count} {step.count === 1 ? 'item' : 'items'}
                </p>
              )}
              {!step.completed && (
                <p className="text-sm text-slate-500 mt-1">Skipped</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Next Steps */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Rocket className="h-5 w-5 text-blue-600" />
          What's Next?
        </h3>
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>Create tasks and start organizing your projects</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>Explore AI features to automate your workflow</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>Set up sprints and use Kanban boards for agile management</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>Check out insights and analytics to track progress</span>
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={onComplete}
          size="lg"
          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8"
        >
          Go to Dashboard
          <Rocket className="h-5 w-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}