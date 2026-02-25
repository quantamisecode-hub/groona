import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

export default function BurndownChartGuide() {
  return (
    <Card className="bg-slate-50 border-slate-200 mt-4">
      <CardContent className="p-4">
        <h4 className="font-semibold text-slate-800 mb-3 text-sm">How to read this chart:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-400 mt-1 flex-shrink-0" />
            <div>
              <span className="font-medium text-slate-700 text-sm">Ideal Guideline (Grey):</span>
              <p className="text-xs text-slate-600 mt-1">
                Represents the perfect scenario where work is completed linearly throughout the sprint. If you are below this line, you are ahead of schedule.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 mt-1 flex-shrink-0" />
            <div>
              <span className="font-medium text-blue-700 text-sm">Actual Remaining (Blue):</span>
              <p className="text-xs text-slate-600 mt-1">
                Shows the real remaining work. It drops when tasks are moved to "Done". Flat lines mean no work was completed that day.
              </p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500 italic border-t border-slate-200 pt-2">
          * Note: Accurate tracking relies on tasks being marked 'Completed' in real-time. Late updates may skew the historical view.
        </p>
      </CardContent>
    </Card>
  );
}
