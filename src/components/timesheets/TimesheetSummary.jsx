import React from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

export default function TimesheetSummary({ timesheets }) {
  const now = new Date();
  
  const thisWeek = timesheets.filter(t => 
    isWithinInterval(new Date(t.date), { 
      start: startOfWeek(now), 
      end: endOfWeek(now) 
    })
  );

  const thisMonth = timesheets.filter(t => 
    isWithinInterval(new Date(t.date), { 
      start: startOfMonth(now), 
      end: endOfMonth(now) 
    })
  );

  const pending = timesheets.filter(t => t.status === 'pending');
  const approved = timesheets.filter(t => t.status === 'approved');

  const weekHours = thisWeek.reduce((sum, t) => sum + (t.hours || 0), 0);
  const monthHours = thisMonth.reduce((sum, t) => sum + (t.hours || 0), 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600 mb-2">This Week</p>
            <p className="text-3xl font-bold text-slate-900">{weekHours.toFixed(1)}h</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-100">
            <Clock className="h-6 w-6 text-blue-600" />
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600 mb-2">This Month</p>
            <p className="text-3xl font-bold text-slate-900">{monthHours.toFixed(1)}h</p>
          </div>
          <div className="p-3 rounded-xl bg-green-100">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600 mb-2">Pending</p>
            <p className="text-3xl font-bold text-slate-900">{pending.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-100">
            <AlertCircle className="h-6 w-6 text-amber-600" />
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600 mb-2">Approved</p>
            <p className="text-3xl font-bold text-slate-900">{approved.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
        </div>
      </Card>
    </div>
  );
}