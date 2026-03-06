import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";
import { useUser } from "../shared/UserContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function SprintVelocityChart({ title: propTitle, isAdmin, tenantId, className }) {
    const { user: currentUser } = useUser();
    const navigate = useNavigate();
    const title = propTitle || (isAdmin ? "Team Sprint Velocity" : "Sprint Velocity");

    // Fetch relevant sprints
    const { data: sprints = [], isLoading: isLoadingSprints } = useQuery({
        queryKey: isAdmin ? ['tenant-sprints-velocity', tenantId] : ['my-sprints-velocity', currentUser?.email],
        queryFn: async () => {
            if (isAdmin) {
                if (!tenantId) return [];
                return groonabackend.entities.Sprint.filter({ tenant_id: tenantId });
            }
            // For a regular user, ideally we'd filter by projects they belong to.
            // But since the API requires filtering, we fetch all tenant ones and will filter locally if we had project membership.
            // Assuming tenant_id is available on currentUser, or we fetch all and let the endpoint handle scoping if secured.
            if (!currentUser?.tenant_id) return [];
            return groonabackend.entities.Sprint.filter({ tenant_id: currentUser.tenant_id });
        },
        enabled: isAdmin ? !!tenantId : !!currentUser?.tenant_id,
        staleTime: 60000,
    });

    // Fetch all stories for the tenant to calculate points
    const { data: stories = [], isLoading: isLoadingStories } = useQuery({
        queryKey: isAdmin ? ['tenant-stories-velocity', tenantId] : ['my-stories-velocity', currentUser?.tenant_id],
        queryFn: async () => {
            const tId = isAdmin ? tenantId : currentUser?.tenant_id;
            if (!tId) return [];
            return groonabackend.entities.Story.filter({ tenant_id: tId });
        },
        enabled: isAdmin ? !!tenantId : !!currentUser?.tenant_id,
        staleTime: 60000,
    });

    const isLoading = isLoadingSprints || isLoadingStories;

    const chartData = useMemo(() => {
        if (!sprints.length) return [];

        // First, calculate points for ALL sprints
        const processedSprints = sprints.map((sprint, index) => {
            const sprintStories = stories.filter(story => story.sprint_id === sprint.id);

            const planned = sprintStories.reduce((sum, story) => sum + (Number(story.story_points) || 0), 0) || 0;
            const completed = sprintStories
                .filter(story => {
                    const status = (story.status || '').toLowerCase();
                    return status === 'done' || status === 'completed';
                })
                .reduce((sum, story) => sum + (Number(story.story_points) || 0), 0) || 0;

            const finalPlanned = planned > 0 ? planned : (Number(sprint.total_points) || 0);
            const finalCompleted = completed > 0 || planned > 0 ? completed : (Number(sprint.completed_points) || 0);

            // Calculate completion percentage, avoiding division by zero
            const completionRate = finalPlanned > 0 ? (finalCompleted / finalPlanned) : 0;

            // Ensure planned is at least as big as completed for realistic visualization
            const adjustedPlanned = Math.max(finalPlanned, finalCompleted);

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
                completed: finalCompleted,
                planned: adjustedPlanned,
                completionRate,
                startDate: new Date(sprint.start_date || 0) // Keep date for secondary sorting if needed
            };
        });

        // Now sort by best performance (highest completion rate first), and take top 5
        const topPerformers = processedSprints
            .sort((a, b) => {
                if (b.completionRate !== a.completionRate) {
                    return b.completionRate - a.completionRate; // Highest rate first
                }
                // If rates are equal, show the one with more completed points
                if (b.completed !== a.completed) {
                    return b.completed - a.completed;
                }
                // Finally, fallback to most recent date
                return b.startDate - a.startDate;
            })
            .slice(0, 10)
            .reverse(); // Reverse so they display left-to-right (maybe you want ascending order on the chart)

        return topPerformers;
    }, [sprints, stories]);

    // Calculate maximum value for Y-axis scaling
    const maxVal = useMemo(() => {
        if (chartData.length === 0) return 20; // Default max if no data
        return Math.max(...chartData.map(d => d.planned), 20); // Minimum scale of 20
    }, [chartData]);

    if (isLoading) {
        return (
            <Card className={`w-full flex flex-col bg-white border-0 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-100/80 rounded-[28px] overflow-hidden ${className || ''}`}>
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
        <Card className={`w-full flex flex-col bg-white border-0 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-100/80 rounded-[28px] overflow-hidden ${className || ''}`}>
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
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-lg mt-[-10px]"
                    onClick={() => navigate('/projects')}
                    title="View Projects"
                >
                    <MoreHorizontal className="h-5 w-5" />
                </Button>
            </CardHeader>

            <CardContent className="px-6 pb-8 pt-6 flex-1 flex flex-col justify-end">
                {chartData.length === 0 ? (
                    <div className="h-[180px] sm:h-[220px] flex items-center justify-center bg-slate-50/50 rounded-[24px]">
                        <p className="text-[14px] text-slate-500 font-medium px-4 text-center">Not enough sprint data.</p>
                    </div>
                ) : (
                    <div className="flex items-end justify-between h-[180px] sm:h-[220px] xl:h-[240px] gap-1 sm:gap-2 md:gap-4 relative w-full group overflow-x-auto scrollbar-hide pb-2">
                        {/* Background lines mapping to maxVal */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none -z-10 py-1">
                            <div className="border-b border-slate-100/60 w-full h-[1px]"></div>
                            <div className="border-b border-slate-100/60 w-full h-[1px]"></div>
                            <div className="border-b border-slate-100/60 w-full h-[1px]"></div>
                            <div className="border-b border-slate-100/60 w-full h-[1px]"></div>
                        </div>

                        {chartData.map((item, index) => {
                            const plannedHeight = (item.planned / maxVal) * 100;
                            const completedHeight = (item.completed / maxVal) * 100;

                            // Check if team over-delivered (completed > planned) or hit target exactly
                            const isExcellent = item.completed >= item.planned && item.planned > 0;

                            return (
                                <div key={index} className="flex flex-col items-center flex-1 min-w-[30px] sm:min-w-[40px] justify-end h-full group/bar relative">
                                    {/* Tooltip on Hover - Optimized for mobile (hidden there, shown on sm+) */}
                                    <div className="hidden sm:flex absolute -top-10 bg-slate-800 text-white text-[11px] px-3 py-1.5 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-20 pointer-events-none flex-col items-center">
                                        <span className="font-semibold">{item.name}</span>
                                        <span className="text-slate-300">{item.completed}/{item.planned} pts</span>
                                    </div>

                                    {/* Dual Bar Container */}
                                    <div className="relative w-full max-w-[28px] sm:max-w-[40px] h-full flex items-end justify-center">
                                        {/* Planned Background Bar */}
                                        <div
                                            className="absolute bottom-0 w-full max-w-[24px] sm:max-w-[32px] rounded-t-lg sm:rounded-t-xl bg-slate-100 transition-all duration-500 will-change-transform z-0"
                                            style={{ height: `${Math.max(plannedHeight, completedHeight)}%` }}
                                        />

                                        {/* Completed Foreground Bar */}
                                        <div
                                            className={`absolute bottom-0 w-full max-w-[24px] sm:max-w-[32px] rounded-t-lg sm:rounded-t-xl transition-all duration-700 ease-out z-10 ${isExcellent ? 'bg-emerald-500 shadow-sm' : 'bg-blue-600 shadow-sm'
                                                }`}
                                            style={{
                                                height: `${completedHeight}%`,
                                                minHeight: item.completed > 0 ? '4px' : '0'
                                            }}
                                        >
                                            {/* Top gradient hit */}
                                            <div className="absolute top-0 inset-x-0 h-2 sm:h-4 bg-white/20 rounded-t-lg sm:rounded-t-xl" />
                                        </div>
                                    </div>

                                    {/* X-Axis Label */}
                                    <span className="mt-2 sm:mt-4 text-[10px] sm:text-[12px] font-semibold text-slate-500 uppercase tracking-wider group-hover/bar:text-slate-800 transition-colors">
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
