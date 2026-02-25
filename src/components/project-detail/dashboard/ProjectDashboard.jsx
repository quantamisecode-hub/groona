import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import StatusWidget from "./StatusWidget";
import WorkloadWidget from "./WorkloadWidget";
import ProgressWidget from "./ProgressWidget";
import RecentActivityWidget from "./RecentActivityWidget";
import MilestonesWidget from "./MilestonesWidget";
import DashboardCustomizer, { AVAILABLE_WIDGETS } from "./DashboardCustomizer";

// Default configuration if none exists
const DEFAULT_WIDGETS = ['status', 'progress', 'workload', 'activity'];

export default function ProjectDashboard({
  project,
  tasks,
  stories,
  activities,
  onUpdateSettings
}) {
  const [showCustomizer, setShowCustomizer] = useState(false);

  // Load settings from project entity or use defaults
  const activeWidgets = project.dashboard_settings?.widgets || DEFAULT_WIDGETS;

  const handleSaveSettings = (newWidgets) => {
    onUpdateSettings({
      dashboard_settings: {
        ...project.dashboard_settings,
        widgets: newWidgets
      }
    });
    setShowCustomizer(false);
  };

  // Widget Registry
  const renderWidget = (id) => {
    switch (id) {
      case 'status':
        return <StatusWidget tasks={tasks} />;
      case 'workload':
        // Passed 'project' prop to allow access to team members/context
        return <WorkloadWidget tasks={tasks} project={project} />;
      case 'progress':
        return <ProgressWidget tasks={tasks} stories={stories} project={project} />;
      case 'activity':
        return <RecentActivityWidget activities={activities} />;
      case 'milestones':
        return <MilestonesWidget projectId={project.id} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-900">Project Dashboard</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCustomizer(true)}
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          Customize
        </Button>
      </div>

      {activeWidgets.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <p className="text-slate-500 mb-4">No widgets selected.</p>
          <Button onClick={() => setShowCustomizer(true)}>Customize Dashboard</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* We map through active widgets. Some might span 2 cols if we wanted more complex layout */}
          {activeWidgets.map(widgetId => (
            <div key={widgetId} className="min-h-[300px]">
              {renderWidget(widgetId)}
            </div>
          ))}
        </div>
      )}

      <DashboardCustomizer
        open={showCustomizer}
        onClose={() => setShowCustomizer(false)}
        currentWidgets={activeWidgets}
        onSave={handleSaveSettings}
      />
    </div>
  );
}