import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";
import { useUser } from "../shared/UserContext";
import { startOfWeek, endOfWeek, eachDayOfInterval, format, parseISO, isSameDay } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";

export default function WeeklyTimesheetChart({ title: propTitle, isAdmin, tenantId }) {
    const { user: currentUser } = useUser();
    const title = propTitle || (isAdmin ? "Team Avg Time Logged This Week" : "Time Logged This Week");

    // Fetch user's timesheets or team's timesheets depending on role
    const { data: timesheets = [], isLoading: isLoadingTimesheets } = useQuery({
        queryKey: isAdmin ? ['tenant-timesheets-chart', tenantId] : ['my-timesheets-chart', currentUser?.email],
        queryFn: async () => {
            if (isAdmin) {
                if (!tenantId) return [];
                return groonabackend.entities.Timesheet.filter(
                    { tenant_id: tenantId },
                    '-date'
                );
            }
            if (!currentUser?.email) return [];
            return groonabackend.entities.Timesheet.filter(
                { user_email: currentUser.email },
                '-date'
            );
        },
        enabled: isAdmin ? !!tenantId : !!currentUser,
        staleTime: 60000,
    });

    // If admin, fetch tenant members to calculate the average
    const { data: members = [], isLoading: isLoadingMembers } = useQuery({
        queryKey: ['tenant-members-weekly-chart', tenantId],
        queryFn: async () => {
            if (!tenantId) return [];
            return groonabackend.entities.User.filter({ tenant_id: tenantId });
        },
        enabled: !!isAdmin && !!tenantId,
        staleTime: 5 * 60 * 1000,
    });

    const isLoading = isLoadingTimesheets || (isAdmin && isLoadingMembers);

    // Calculate weekly data
    const chartData = useMemo(() => {
        const today = new Date();
        const start = startOfWeek(today, { weekStartsOn: 1 }); // Monday start
        const end = endOfWeek(today, { weekStartsOn: 1 }); // Ends on Sunday

        // Generate array of days, removing Sunday
        let days = eachDayOfInterval({ start, end });
        days = days.filter(day => day.getDay() !== 0); // 0 is Sunday

        return days.map(day => {
            // Find timesheets for this specific day
            const dayTimesheets = timesheets.filter(t => {
                if (!t.date) return false;
                // Parse the timesheet date (usually comes as YYYY-MM-DD or ISO string)
                const tDate = parseISO(t.date);
                return isSameDay(tDate, day);
            });

            // Sum up the total minutes and convert to decimal hours
            const totalMinutes = dayTimesheets.reduce((sum, t) => sum + (Number(t.total_minutes) || 0), 0);
            let totalHours = Number((totalMinutes / 60).toFixed(1));

            // If admin, calculate average per member
            if (isAdmin && members.length > 0) {
                totalHours = Number((totalHours / members.length).toFixed(1));
            }

            return {
                day: format(day, 'EEE'), // 'Sun', 'Mon', etc.
                value: totalHours
            };
        });
    }, [timesheets, isAdmin, members.length]);

    // Find the maximum value to scale the bars correctly
    const maxVal = useMemo(() => Math.max(...chartData.map(d => d.value), 4), [chartData]); // min scale of 4 hours

    // Identify today's index
    const todayIndex = useMemo(() => {
        const todayStr = format(new Date(), 'EEE');
        return chartData.findIndex(d => d.day === todayStr);
    }, [chartData]);

    if (isLoading) {
        return (
            <Card className="w-full max-w-[500px] bg-white border-0 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-100/80 rounded-[28px] overflow-hidden">
                <CardHeader className="p-6 pb-2">
                    <CardTitle className="text-[17px] font-semibold text-slate-900 tracking-tight">{title}</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-8 pt-4">
                    <Skeleton className="h-[260px] w-full rounded-[20px]" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full flex flex-col bg-white border-0 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-100/80 rounded-[28px] overflow-hidden">
            <CardHeader className="p-6 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-[17px] font-semibold text-slate-900 tracking-tight">{title}</CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-full mt-[-10px]">
                    <MoreHorizontal className="h-5 w-5" />
                </Button>
            </CardHeader>

            <CardContent className="px-6 pb-8 pt-4 flex-1 flex flex-col justify-end">
                {/* Chart Container */}
                <div className="flex items-end justify-between h-[220px] gap-2">
                    {chartData.map((item, index) => {
                        const isToday = index === todayIndex;
                        const isFuture = index > todayIndex && todayIndex !== -1;

                        // Height percentage based on max value
                        const heightPercent = item.value === 0
                            ? (isFuture ? 0 : 8)
                            : Math.max((item.value / maxVal) * 100, 8); // Minimum 8% height so it's a visible pill

                        // If it's a future day with no value, just show text, no bar needed. 
                        // Or if you want empty gray pills even for past 0 value days, we leave min height.

                        return (
                            <div key={item.day} className="flex flex-col items-center flex-1 justify-end h-full group">
                                {/* Floating Value */}
                                <div
                                    className={`text-[13px] font-semibold mb-2 transition-opacity duration-300 ${isToday && item.value > 0 ? 'text-slate-800 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-100'
                                        }`}
                                >
                                    {item.value > 0 ? `${item.value}h` : ''}
                                </div>

                                {/* The Pill Bar */}
                                <div
                                    className={`w-full max-w-[48px] rounded-full transition-all duration-500 ease-out relative ${isToday
                                        ? 'bg-blue-500 shadow-sm'
                                        : item.value > 0 || !isFuture
                                            ? 'bg-[#f1f3f5] hover:bg-[#e9ecef]'
                                            : 'bg-transparent'
                                        }`}
                                    style={{
                                        height: `${heightPercent}%`,
                                        minHeight: (item.value > 0 || !isFuture) ? '24px' : '0px'
                                    }}
                                >
                                    {/* Gradient overlay for active bar */}
                                    {isToday && (
                                        <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
                                    )}
                                </div>

                                {/* Day Label */}
                                <span
                                    className={`mt-3 text-[13px] font-medium transition-colors ${isToday ? 'text-blue-600' : 'text-slate-400'
                                        }`}
                                >
                                    {item.day}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
