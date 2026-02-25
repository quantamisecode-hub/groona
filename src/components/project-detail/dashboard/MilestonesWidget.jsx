import React from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flag, Calendar, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export default function MilestonesWidget({ projectId }) {
  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: () => groonabackend.entities.Milestone.filter({ project_id: projectId }, 'due_date'),
    enabled: !!projectId,
  });

  const upcomingMilestones = milestones
    .filter(m => m.status !== 'completed' && m.status !== 'missed')
    .slice(0, 3);

  if (isLoading) return <Card className="h-full"><CardContent className="pt-6">Loading...</CardContent></Card>;

  return (
    <Card className="h-full bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">Upcoming Milestones</CardTitle>
        <Flag className="h-4 w-4 text-purple-500" />
      </CardHeader>
      <CardContent>
        {upcomingMilestones.length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-sm">
            No upcoming milestones
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingMilestones.map(milestone => (
              <div key={milestone.id} className="flex items-start gap-3 border-b border-slate-100 last:border-0 pb-3 last:pb-0">
                <div className="mt-0.5 bg-purple-50 p-1.5 rounded text-purple-600">
                  <Flag className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-medium text-sm text-slate-900 truncate pr-2">
                      {milestone.name}
                    </p>
                    <Badge variant="outline" className="text-[10px] px-1 h-5">
                      {milestone.status}
                    </Badge>
                  </div>
                  <div className="flex items-center text-xs text-slate-500">
                    <Calendar className="w-3 h-3 mr-1" />
                    {format(new Date(milestone.due_date), "MMM d")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 pt-2 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
          <span>{milestones.filter(m => m.status === 'completed').length} completed</span>
          <span>{milestones.length} total</span>
        </div>
      </CardContent>
    </Card>
  );
}

