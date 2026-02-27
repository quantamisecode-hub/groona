import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
    format, addDays, isSameDay, parseISO, startOfMonth, endOfMonth,
    startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, addMonths, subMonths, isValid
} from 'date-fns';
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MoreHorizontal } from 'lucide-react';
import { Button } from "@/components/ui/button";

// Apple-style color palettes for calendar events
const TASK_COLORS = [
    { spanBg: 'bg-green-100/60', activeBg: 'bg-green-500', activeText: 'text-white' }, // 1. green
    { spanBg: 'bg-blue-100/60', activeBg: 'bg-blue-500', activeText: 'text-white' },   // 2. blue
    { spanBg: 'bg-red-100/60', activeBg: 'bg-red-500', activeText: 'text-white' },     // 3. red
    { spanBg: 'bg-yellow-100/60', activeBg: 'bg-yellow-500', activeText: 'text-white' }, // 4. yellow
    { spanBg: 'bg-orange-100/60', activeBg: 'bg-orange-500', activeText: 'text-white' }, // 5. orange
    { spanBg: 'bg-purple-100/60', activeBg: 'bg-purple-500', activeText: 'text-white' }, // 6. purple
    { spanBg: 'bg-pink-100/60', activeBg: 'bg-pink-500', activeText: 'text-white' },   // 7. pink
    { spanBg: 'bg-slate-200/60', activeBg: 'bg-slate-700', activeText: 'text-white' },   // 8. dark-gray
    { spanBg: 'bg-stone-200/60', activeBg: 'bg-stone-700', activeText: 'text-white' },   // 9. brown
    { spanBg: 'bg-teal-100/60', activeBg: 'bg-teal-500', activeText: 'text-white' },     // 10. teal
];

export default function UpcomingDeadlines({ tasks = [], onDateSelect, selectedDate }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const { days, startDate, endDate } = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const start = startOfWeek(monthStart);
        const end = endOfWeek(monthEnd);
        return {
            days: eachDayOfInterval({ start, end }),
            startDate: start,
            endDate: end
        };
    }, [currentMonth]);

    // Process all tasks
    const processedTasks = useMemo(() => {
        return tasks.filter(t => t.due_date && t.status !== 'completed').map((t, i) => {
            let start = t.start_date ? parseISO(t.start_date) : null;
            let due = parseISO(t.due_date);

            if (!isValid(due)) return null;
            if (start && !isValid(start)) start = null;
            if (!start) start = due;

            // Normalize times for date math
            const normStart = new Date(start).setHours(0, 0, 0, 0);
            const normDue = new Date(due).setHours(0, 0, 0, 0);

            // Fix inverted dates
            const finalStart = normStart > normDue ? new Date(normDue) : new Date(normStart);
            const finalDue = new Date(normDue);

            return {
                ...t,
                parsedStart: finalStart,
                parsedDue: finalDue,
                colorConfig: TASK_COLORS[i % TASK_COLORS.length],
                isMultiDay: !isSameDay(finalStart, finalDue)
            };
        }).filter(Boolean);
    }, [tasks]);

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    return (
        <Card className="w-full bg-white border-0 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-100/80 rounded-[28px] overflow-hidden">
            <CardHeader className="p-6 pb-2 border-slate-50">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-[17px] font-semibold text-slate-900 tracking-tight">
                        <CalendarIcon className="w-5 h-5" /> Calendar
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-50 rounded-full p-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-slate-500 hover:text-slate-900 focus:bg-white focus:shadow-sm" onClick={prevMonth}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-[13px] font-medium text-slate-700 w-16 text-center">
                                {format(currentMonth, 'MMM')}
                            </span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-slate-500 hover:text-slate-900 focus:bg-white focus:shadow-sm" onClick={nextMonth}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-full bg-slate-50 ml-1">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-6 pt-2">
                <div className="grid grid-cols-7 gap-y-2 mt-2">
                    {/* Weekdays */}
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                        <div key={d} className="text-center text-[12px] font-medium text-slate-400 mb-2">
                            {d}
                        </div>
                    ))}

                    {/* Days */}
                    {days.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const isCurrentMonth = isSameMonth(day, currentMonth);
                        const isToday = isSameDay(day, new Date());
                        const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;

                        const dayTime = day.getTime();

                        // Tasks spanning this day
                        const spanningTasks = processedTasks.filter(t => dayTime >= t.parsedStart.getTime() && dayTime <= t.parsedDue.getTime());
                        const multiDayTask = spanningTasks.find(t => t.isMultiDay);
                        const singleDayTasks = spanningTasks.filter(t => !t.isMultiDay);

                        let isPillStart = false;
                        let isPillEnd = false;
                        let spanClasses = "";
                        let activeBgClass = "";

                        if (multiDayTask) {
                            isPillStart = isSameDay(day, multiDayTask.parsedStart);
                            isPillEnd = isSameDay(day, multiDayTask.parsedDue);
                            const cfg = multiDayTask.colorConfig;

                            spanClasses = `absolute inset-y-1 inset-x-0 ${cfg.spanBg} pointer-events-none `;

                            // Bounds calculation
                            if (isPillStart) spanClasses += "rounded-l-full ml-1 ";
                            if (isPillEnd) spanClasses += "rounded-r-full mr-1 ";
                            // Week wrap bounds
                            if (!isPillStart && day.getDay() === 0) spanClasses += "rounded-l-full ml-1 ";
                            if (!isPillEnd && day.getDay() === 6) spanClasses += "rounded-r-full mr-1 ";

                            if (isPillStart || isPillEnd) {
                                activeBgClass = `${cfg.activeBg} ${cfg.activeText} shadow-md border border-white/20`; // Apple style soft solid
                            }
                        }

                        // Determine main button classes layer by layer
                        let buttonClass = "relative z-10 w-9 h-9 mx-auto flex items-center justify-center rounded-full text-[15px] transition-all outline-none ";

                        if (!isCurrentMonth) {
                            buttonClass += "text-slate-300 ";
                        } else {
                            if (isSelected) {
                                // Explicit user selection overrides visual (or highlights it further)
                                buttonClass += "bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-2 font-semibold ";
                            } else if (activeBgClass) {
                                buttonClass += activeBgClass + " font-semibold ";
                            } else if (isToday) {
                                buttonClass += "font-bold text-slate-900 border border-slate-200 bg-white shadow-sm ";
                            } else {
                                buttonClass += "text-slate-600 hover:bg-slate-100/70 ";
                            }
                        }

                        return (
                            <div key={dateStr} className="relative h-11 w-full flex justify-center items-center">
                                {/* Spanning background for multi-day events */}
                                {multiDayTask && isCurrentMonth && (
                                    <div className={spanClasses} />
                                )}

                                <button
                                    onClick={() => onDateSelect && onDateSelect(isSelected ? null : day)}
                                    className={buttonClass}
                                >
                                    {format(day, 'd')}
                                </button>

                                {/* Dot indicators for single day tasks directly underneath */}
                                {(!multiDayTask || (!isPillStart && !isPillEnd)) && singleDayTasks.length > 0 && isCurrentMonth && (
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-0.5 mt-0.5">
                                        {Array.from({ length: Math.min(singleDayTasks.length, 3) }).map((_, i) => (
                                            <div key={i} className="w-1 h-1 rounded-full bg-slate-300" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
