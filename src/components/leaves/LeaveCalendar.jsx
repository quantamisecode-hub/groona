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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <div className="flex items-center rounded-md border border-slate-200 bg-white shadow-sm">
            <Button variant="ghost" size="icon" onClick={previousMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="w-px h-8 bg-slate-200" />
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          {Object.entries(leaveTypeColors).map(([type, classes]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-full ${classes.split(' ')[0]}`} />
              <span className="text-xs text-slate-600 capitalize">{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 border-b border-slate-200">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="p-3 text-center text-sm font-medium text-slate-500 border-r border-slate-200 last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr bg-slate-50">
        {daysInMonth.map((day, dayIdx) => {
          const dayLeaves = getLeavesForDay(day);
          // Calculate grid column start for the first day of the month
          const colStart = dayIdx === 0 ? `col-start-${day.getDay() + 1}` : "";
          
          return (
            <div 
              key={day.toString()} 
              className={`min-h-[120px] p-2 border-b border-r border-slate-200 bg-white ${colStart} hover:bg-slate-50 transition-colors`}
            >
              <div className={`text-sm font-medium mb-2 flex justify-between items-center ${isToday(day) ? "text-blue-600" : "text-slate-700"}`}>
                <span className={isToday(day) ? "bg-blue-100 w-7 h-7 flex items-center justify-center rounded-full" : ""}>
                  {format(day, "d")}
                </span>
                {dayLeaves.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                    {dayLeaves.length}
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                <TooltipProvider>
                  {dayLeaves.map((leave, i) => (
                    <Tooltip key={leave.id}>
                      <TooltipTrigger asChild>
                        <div 
                          className={`text-[10px] p-1.5 rounded border truncate cursor-pointer ${leaveTypeColors[leave.leave_type] || leaveTypeColors.other}`}
                          onClick={() => onLeaveClick && onLeaveClick(leave)}
                        >
                          {leave.user_name.split(' ')[0]} - {leave.leave_type}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs">
                          <p className="font-semibold">{leave.user_name}</p>
                          <p className="capitalize">{leave.leave_type.replace('_', ' ')}</p>
                          <p>{leave.reason}</p>
                          <p className="text-slate-400">{leave.status}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </TooltipProvider>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}