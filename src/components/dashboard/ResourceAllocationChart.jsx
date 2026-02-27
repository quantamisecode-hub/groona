import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";
import { useUser } from "../shared/UserContext";
import { startOfWeek, endOfWeek, parseISO, isWithinInterval } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";

export default function ResourceAllocationChart({ title = "Resource Allocation" }) {
    const { user: currentUser } = useUser();

    // Fetch user's timesheets for the current week to calculate allocation
    const { data: timesheets = [], isLoading } = useQuery({
        queryKey: ['my-timesheets-allocation', currentUser?.email],
        queryFn: async () => {
            if (!currentUser?.email) return [];
            return groonabackend.entities.Timesheet.filter(
                { user_email: currentUser.email },
                '-date'
            );
        },
        enabled: !!currentUser,
        staleTime: 60000,
    });

    const { targetPercentage, currentPercentage } = useMemo(() => {
        const today = new Date();
        const start = startOfWeek(today, { weekStartsOn: 1 });
        const end = endOfWeek(today, { weekStartsOn: 1 });

        // Filter timesheets within this week
        const weekTimesheets = timesheets.filter(t => {
            if (!t.date) return false;
            const tDate = parseISO(t.date);
            return isWithinInterval(tDate, { start, end });
        });

        // Sum up the total minutes logged
        const totalMinutes = weekTimesheets.reduce((sum, t) => sum + (Number(t.total_minutes) || 0), 0);
        const hoursLoggedThisWeek = Number((totalMinutes / 60).toFixed(1));

        // Capacity calculation
        const dailyHours = Number(currentUser?.working_hours_per_day) || 8;
        const capacity = dailyHours * 5; // standard 5 day work week capacity

        // Target is generally 80% allocation minimum for healthy resource usage
        const targetPercent = 80;
        const currentPercent = capacity > 0 ? Math.min(Math.round((hoursLoggedThisWeek / capacity) * 100), 100) : 0;

        return {
            targetPercentage: targetPercent,
            currentPercentage: currentPercent,
            hoursLogged: hoursLoggedThisWeek,
            weeklyCapacity: capacity
        };
    }, [timesheets, currentUser]);

    // Segment generation for the semi-circle gauge
    const segments = 40;
    const innerRadius = 70;
    const outerRadius = 90;
    const cx = 100;
    const cy = 100;

    // Create the segments
    const gaugePieces = Array.from({ length: segments }).map((_, i) => {
        // Angle goes from -180 to 0 degrees => in radians: PI to 0
        // We calculate from left to right (-180 to 0)
        const angleDeg = -180 + (i * (180 / (segments - 1)));
        const angleRad = (angleDeg * Math.PI) / 180;

        const x1 = cx + innerRadius * Math.cos(angleRad);
        const y1 = cy + innerRadius * Math.sin(angleRad);
        const x2 = cx + outerRadius * Math.cos(angleRad);
        const y2 = cy + outerRadius * Math.sin(angleRad);

        // Determine if this segment should be "filled"
        const percentFill = (i / (segments - 1)) * 100;
        const isFilled = percentFill <= currentPercentage;

        // Dynamic green gradient effect: it gets slightly darker/richer green as it goes right, 
        // to mimic the image's vibrant aesthetic
        const strokeColor = isFilled ? '#22c55e' : '#f1f5f9'; // emerald-500 : slate-100

        return (
            <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={strokeColor}
                strokeWidth="4"
                strokeLinecap="round"
                className="transition-colors duration-700 ease-in-out"
            />
        );
    });

    if (isLoading) {
        return (
            <Card className="w-full max-w-[500px] bg-white border-0 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-100/80 rounded-[28px] overflow-hidden">
                <CardHeader className="p-6 pb-2">
                    <CardTitle className="text-[17px] font-semibold text-slate-900 tracking-tight">{title}</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-8 pt-4">
                    <Skeleton className="h-[220px] w-full rounded-[20px]" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full flex flex-col bg-white border-0 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-100/80 rounded-[28px] overflow-hidden">
            <CardHeader className="p-6 pb-0 flex flex-row items-center justify-between">
                <CardTitle className="text-[17px] font-semibold text-slate-900 tracking-tight">{title}</CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-full">
                    <MoreHorizontal className="h-5 w-5" />
                </Button>
            </CardHeader>

            <CardContent className="px-6 pb-8 pt-4 flex-1 flex flex-col items-center justify-center">

                {/* Gauge SVG Container */}
                <div className="relative w-full max-w-[280px] mt-4 mb-2">
                    {/* SVG Viewport ensures it scales smoothly */}
                    <svg viewBox="0 0 200 110" className="w-full overflow-visible">
                        {gaugePieces}
                    </svg>

                    {/* Centered Text Elements overlaid on the half-circle */}
                    <div className="absolute inset-x-0 bottom-1 flex flex-col items-center justify-end text-center">
                        <span className="text-[44px] font-bold text-slate-900 tracking-tight leading-none mb-1">
                            {currentPercentage}%
                        </span>
                        <span className="text-[13px] font-medium text-slate-500">
                            On track for {targetPercentage}% target
                        </span>
                    </div>
                </div>

                <div className="flex-1 min-h-[1.5rem]" /> {/* Spacer to balance height */}

                <Button variant="outline" className="mt-auto mb-2 rounded-[14px] border-slate-200 text-slate-700 hover:bg-slate-50 font-medium px-6 shadow-sm">
                    Show details
                </Button>

            </CardContent>
        </Card>
    );
}
