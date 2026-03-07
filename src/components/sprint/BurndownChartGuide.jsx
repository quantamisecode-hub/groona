import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

export default function BurndownChartGuide() {
  return (
    <Card className="bg-white/40 backdrop-blur-sm border-slate-200/50 shadow-sm rounded-[24px] overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-1 w-8 rounded-full bg-slate-200" />
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Usage Guide</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex items-start gap-4 group">
            <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center flex-shrink-0 border border-slate-100 shadow-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-slate-100" />
            </div>
            <div className="space-y-1.5">
              <span className="text-[13px] font-black text-slate-800 uppercase tracking-tight">Ideal Guideline (Grey)</span>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Represents the perfect scenario where work is completed linearly throughout the sprint. Staying below this line indicates you are ahead of schedule.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 group">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center flex-shrink-0 border border-indigo-100/50 shadow-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-100" />
            </div>
            <div className="space-y-1.5">
              <span className="text-[13px] font-black text-indigo-600 uppercase tracking-tight">Actual Remaining (Indigo)</span>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Tracks real-time progress. It drops when tasks are marked as <span className="text-indigo-500 font-bold uppercase text-[9px]">Completed</span>. A flat line indicates a period without progress updates.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-100/50 flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">
            Note: Historical accuracy depends on real-time task status updates.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
