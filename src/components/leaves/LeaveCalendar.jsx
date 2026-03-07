import React from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO, isWithinInterval } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function LeaveCalendar({ leaves = [], currentDate, onDateChange, onLeaveClick }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group leaves by date for easier lookup
  const getLeavesForDay = (day) => {
    return leaves.filter(leave => {
      const start = parseISO(leave.start_date);
      const end = parseISO(leave.end_date);
      return isWithinInterval(day, { start, end });
    });
  };

  const previousMonth = () => {
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const leaveTypeColors = {
    vacation: "bg-blue-100 text-blue-700 border-blue-200",
    sick: "bg-red-100 text-red-700 border-red-200",
    personal: "bg-amber-100 text-amber-700 border-amber-200",
    public_holiday: "bg-green-100 text-green-700 border-green-200",
    other: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div className="bg-white rounded-[12px] border border-slate-200/60 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-slate-100 bg-white">
        <div className="flex items-center gap-4">
          <h2 className="text-[17px] font-black text-slate-800 tracking-tight">
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <div className="flex items-center bg-slate-50 border border-slate-200/60 rounded-[10px] p-0.5">
            <Button variant="ghost" size="icon" onClick={previousMonth} className="h-8 w-8 rounded-[8px] hover:bg-white hover:shadow-sm">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 rounded-[8px] hover:bg-white hover:shadow-sm">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="hidden md:flex gap-3">
          {Object.entries(leaveTypeColors).map(([type, classes]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${classes.split(' ')[0]}`} />
              <span className="text-[10px] font-black tracking-widest text-slate-400 capitalize uppercase">{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/30">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="py-3 text-center text-[10px] font-black tracking-widest text-slate-400 uppercase">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr">
        {daysInMonth.map((day, dayIdx) => {
          const dayLeaves = getLeavesForDay(day);
          const colStart = dayIdx === 0 ? `col-start-${day.getDay() + 1}` : "";
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <div
              key={day.toString()}
              className={`min-h-[130px] p-2 border-b border-r border-slate-100 ${colStart} ${isWeekend ? "bg-slate-50/30" : "bg-white"} hover:bg-slate-50/50 transition-colors`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-black transition-all",
                  isToday(day)
                    ? "bg-slate-900 text-white shadow-md ring-4 ring-slate-100"
                    : "text-slate-800"
                )}>
                  {format(day, "d")}
                </span>
                {dayLeaves.length > 0 && (
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-2 mr-1" />
                )}
              </div>

              <div className="space-y-1">
                <TooltipProvider>
                  {dayLeaves.slice(0, 3).map((leave, i) => (
                    <Tooltip key={leave.id}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-full border shadow-sm truncate transition-all",
                            leaveTypeColors[leave.leave_type] || leaveTypeColors.other
                          )}
                          onClick={() => onLeaveClick && onLeaveClick(leave)}
                        >
                          {leave.user_name.split(' ')[0]}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="border-none rounded-[12px] shadow-2xl p-4 bg-white ring-1 ring-slate-100">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600">
                              {leave.user_name?.[0]}
                            </div>
                            <span className="text-[13px] font-bold text-slate-800">{leave.user_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest rounded-full border-slate-200">
                              {leave.leave_type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-[12px] text-slate-500 italic mt-1 leading-relaxed">“{leave.reason}”</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {dayLeaves.length > 3 && (
                    <p className="text-[9px] font-black text-slate-400 text-center uppercase tracking-widest mt-1">
                      +{dayLeaves.length - 3} more
                    </p>
                  )}
                </TooltipProvider>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}