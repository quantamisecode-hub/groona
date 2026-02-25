import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays } from "date-fns";
import { Flag, CheckCircle2, Calendar, TrendingUp } from "lucide-react";

export default function MilestoneRoadmapView({ milestones = [], onMilestoneClick }) {
  if (milestones.length === 0) {
    return (
      <Card className="bg-slate-50 border-dashed">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mb-4" />
          <p className="text-slate-500">No milestones to display</p>
        </CardContent>
      </Card>
    );
  }

  const statusColors = {
    pending: { border: "border-slate-400", bg: "bg-slate-50", text: "text-slate-700" },
    in_progress: { border: "border-blue-500", bg: "bg-blue-50", text: "text-blue-700" },
    completed: { border: "border-green-500", bg: "bg-green-50", text: "text-green-700" },
    missed: { border: "border-red-500", bg: "bg-red-50", text: "text-red-700" },
  };

  // Sort by due date
  const sortedMilestones = [...milestones].sort((a, b) => 
    new Date(a.due_date) - new Date(b.due_date)
  );

  const today = new Date();

  return (
    <div className="relative">
      {/* Vertical Timeline */}
      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-purple-200 to-pink-200 -translate-x-1/2" />

      <div className="space-y-12 relative">
        {sortedMilestones.map((milestone, idx) => {
          const dueDate = new Date(milestone.due_date);
          const isOverdue = dueDate < today && milestone.status !== 'completed';
          const daysUntil = differenceInDays(dueDate, today);
          const colors = statusColors[milestone.status];
          const isLeft = idx % 2 === 0;

          return (
            <div key={milestone.id} className="relative">
              {/* Timeline Node */}
              <div className="absolute left-1/2 -translate-x-1/2 z-10">
                <div className={`w-8 h-8 rounded-full ${colors.bg} ${colors.border} border-4 shadow-lg flex items-center justify-center`}>
                  {milestone.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <Flag className="w-3 h-3 text-slate-600" />
                  )}
                </div>
              </div>

              {/* Milestone Card */}
              <div className={`w-5/12 ${isLeft ? 'mr-auto pr-12' : 'ml-auto pl-12'}`}>
                <Card 
                  className={`${colors.border} border-l-4 hover:shadow-lg transition-all cursor-pointer ${isOverdue ? 'ring-2 ring-red-200' : ''}`}
                  onClick={() => onMilestoneClick && onMilestoneClick(milestone)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900 text-lg">{milestone.name}</h3>
                      <Badge variant="secondary" className={`${colors.text} whitespace-nowrap`}>
                        {milestone.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    {milestone.description && (
                      <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                        {milestone.description}
                      </p>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar className="w-4 h-4" />
                        <span>Due: {format(dueDate, "MMM d, yyyy")}</span>
                        {isOverdue && (
                          <Badge variant="destructive" className="ml-auto text-xs">
                            Overdue
                          </Badge>
                        )}
                        {!isOverdue && daysUntil >= 0 && daysUntil <= 7 && milestone.status !== 'completed' && (
                          <Badge variant="secondary" className="ml-auto text-xs bg-amber-100 text-amber-700">
                            {daysUntil} days left
                          </Badge>
                        )}
                      </div>

                      {milestone.start_date && (
                        <div className="text-sm text-slate-500">
                          Started: {format(new Date(milestone.start_date), "MMM d, yyyy")}
                        </div>
                      )}

                      {milestone.progress > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-600">
                            <span>Progress</span>
                            <span className="font-medium">{milestone.progress}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full ${milestone.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'} transition-all`}
                              style={{ width: `${milestone.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {milestone.dependencies && milestone.dependencies.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                          <TrendingUp className="w-3 h-3" />
                          <span>Depends on {milestone.dependencies.length} milestone{milestone.dependencies.length > 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}