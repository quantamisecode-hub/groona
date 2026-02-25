import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { User } from "lucide-react";

export default function RecentActivityWidget({ activities }) {
  const recent = activities.slice(0, 5);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No recent activity</p>
          ) : (
            recent.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 text-sm">
                 <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                   <User className="h-4 w-4 text-slate-500" />
                 </div>
                 <div className="flex-1 min-w-0">
                   <p className="text-slate-900 font-medium truncate">
                     <span className="text-blue-600">{activity.user_name}</span> {activity.action} {activity.entity_type}
                   </p>
                   <p className="text-slate-500 text-xs truncate">{activity.entity_name}</p>
                   <p className="text-slate-400 text-[10px] mt-0.5">
                     {format(new Date(activity.created_date), "MMM d, h:mm a")}
                   </p>
                 </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}