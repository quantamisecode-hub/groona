import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LayoutGrid, Save } from "lucide-react";

export const AVAILABLE_WIDGETS = [
  { id: 'status', label: 'Task Status', description: 'Pie chart of task statuses' },
  { id: 'progress', label: 'Overall Progress', description: 'Key metrics and progress bar' },
  { id: 'workload', label: 'Team Workload', description: 'Tasks distribution by member' },
  { id: 'activity', label: 'Recent Activity', description: 'Latest project events' },
  { id: 'milestones', label: 'Milestones', description: 'Upcoming project milestones' },
  // Add more future widgets here
];

export default function DashboardCustomizer({ open, onClose, currentWidgets, onSave }) {
  const [selected, setSelected] = React.useState(currentWidgets);

  React.useEffect(() => {
    if (open) setSelected(currentWidgets);
  }, [open, currentWidgets]);

  const toggleWidget = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Customize Dashboard
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-slate-500">
            Select the widgets you want to display on the project overview.
          </p>
          <div className="space-y-4">
            {AVAILABLE_WIDGETS.map(widget => (
              <div key={widget.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                <div className="space-y-0.5">
                  <Label className="text-base">{widget.label}</Label>
                  <p className="text-xs text-slate-500">{widget.description}</p>
                </div>
                <Switch
                  checked={selected.includes(widget.id)}
                  onCheckedChange={() => toggleWidget(widget.id)}
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(selected)} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25">
            <Save className="h-4 w-4 mr-2" /> Save Layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}