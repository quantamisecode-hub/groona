import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";
import { useUser } from "../shared/UserContext";
import { Skeleton } from "@/components/ui/skeleton";

export default function SprintVelocityChart({ title = "Sprint Velocity" }) {
    const { user: currentUser } = useUser();

    // Fetch user's sprints to calculate velocity
    const { data: sprints = [], isLoading } = useQuery({
        queryKey: ['my-sprints-velocity', currentUser?.email],
        queryFn: async () => {
            if (!currentUser?.email) return [];
            // Ideally, we'd fetch sprints related to the user's projects.
            // For now, let's fetch recent sprints.
            return groonabackend.entities.Sprint.list();
        },
        enabled: !!currentUser,
        staleTime: 60000,
    });

    const chartData = useMemo(() => {
        if (!sprints.length) return [];

        // Sort sprints by start date (descending) and take the last 5
        const sortedSprints = [...sprints]
            .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
            .slice(0, 5)
            .reverse(); // Reverse to show chronological order (oldest to newest)

        return sortedSprints.map((sprint, index) => {
            const completed = Number(sprint.completed_points) || 0;
            const planned = Number(sprint.total_points) || 10; // Default to 10 if missing to show something

            // Ensure planned is at least as big as completed for realistic visualization
            const adjustedPlanned = Math.max(planned, completed);

            let shortName = `S${index + 1}`;
            let fullName = sprint.name || `Sprint ${index + 1}`;

            if (sprint.name) {
                if (sprint.name.toLowerCase().startsWith('sprint ')) {
                    shortName = 'S' + sprint.name.substring(7).trim();
                } else {
                    shortName = sprint.name.length > 12 ? sprint.name.substring(0, 10) + '..' : sprint.name;
                }
            }

            return {
                name: fullName,
                shortName,
                completed,
                planned: adjustedPlanned
            };
        });
    }, [sprints]);

    // Calculate maximum value for Y-axis scaling
    const maxVal = useMemo(() => {
        if (chartData.length === 0) return 20; // Default max if no data
        return Math.max(...chartData.map(d => d.planned), 20); // Minimum scale of 20
    }, [chartData]);

    if (isLoading) {
        return (
            <Card className="w-full flex flex-col bg-white border-0 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-100/80 rounded-[28px] overflow-hidden">
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
                <div>
                    <CardTitle className="text-[17px] font-semibold text-slate-900 tracking-tight mb-1">{title}</CardTitle>
                    <div className="flex items-center gap-4 text-[12px] font-medium text-slate-500">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-200" /> Planned
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Completed
                        </div>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-full mt-[-10px]">
                    <MoreHorizontal className="h-5 w-5" />
                </Button>
            </CardHeader>

            <CardContent className="px-6 pb-8 pt-6 flex-1 flex flex-col justify-end">
                {chartData.length === 0 ? (
                    <div className="h-[220px] flex items-center justify-center bg-slate-50/50 rounded-[20px]">
                        <p className="text-[14px] text-slate-500 font-medium">Not enough sprint data.</p>
                    </div>
                ) : (
                    <div className="flex items-end justify-between h-[220px] gap-2 md:gap-4 relative w-full group">
                        {/* Background lines mapping to maxVal */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none -z-10 py-1">
                            <div className="border-b border-slate-100 w-full h-[1px]"></div>
                            <div className="border-b border-slate-100 w-full h-[1px]"></div>
                            <div className="border-b border-slate-100 w-full h-[1px]"></div>
                            <div className="border-b border-slate-100 w-full h-[1px]"></div>
                        </div>

                        {chartData.map((item, index) => {
                            const plannedHeight = (item.planned / maxVal) * 100;
                            const completedHeight = (item.completed / maxVal) * 100;

                            // Check if team over-delivered (completed > planned) or hit target exactly
                            const isExcellent = item.completed >= item.planned && item.planned > 0;

                            return (
                                <div key={index} className="flex flex-col items-center flex-1 justify-end h-full group/bar relative">
                                    {/* Tooltip on Hover */}
                                    <div className="absolute -top-10 bg-slate-800 text-white text-[11px] px-3 py-1.5 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-20 pointer-events-none flex flex-col items-center">
                                        <span className="font-semibold">{item.name}</span>
                                        <span className="text-slate-300">{item.completed}/{item.planned} pts</span>
                                    </div>

                                    {/* Dual Bar Container */}
                                    <div className="relative w-full max-w-[40px] h-full flex items-end justify-center">
                                        {/* Planned Background Bar */}
                                        <div
                                            className="absolute bottom-0 w-full max-w-[32px] rounded-t-xl bg-slate-100 transition-all duration-500 will-change-transform z-0"
                                            style={{ height: `${plannedHeight}%` }}
                                        />

                                        {/* Completed Foreground Bar */}
                                        <div
                                            className={`absolute bottom-0 w-full max-w-[32px] rounded-t-xl transition-all duration-700 ease-out z-10 ${isExcellent ? 'bg-emerald-500 shadow-sm' : 'bg-blue-600 shadow-sm'
                                                }`}
                                            style={{
                                                height: `${completedHeight}%`,
                                                minHeight: item.completed > 0 ? '4px' : '0'
                                            }}
                                        >
                                            {/* Top gradient hit */}
                                            <div className="absolute top-0 inset-x-0 h-4 bg-white/20 rounded-t-xl" />
                                        </div>
                                    </div>

                                    {/* X-Axis Label */}
                                    <span className="mt-4 text-[12px] font-semibold text-slate-500 uppercase tracking-wider group-hover/bar:text-slate-800 transition-colors">
                                        {item.shortName}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
