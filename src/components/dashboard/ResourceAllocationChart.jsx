import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";
import { useUser } from "../shared/UserContext";
import { startOfWeek, endOfWeek, parseISO, isWithinInterval, subDays, startOfDay, endOfDay } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function ResourceAllocationChart({ title: propTitle, isAdmin, tenantId }) {
    const { user: currentUser } = useUser();
    const title = propTitle || (isAdmin ? "Team Avg Resource Allocation" : "Resource Allocation");

    // Fetch stories instead of timesheets for future workload
    const { data: stories = [], isLoading: isLoadingStories } = useQuery({
        queryKey: isAdmin ? ['tenant-stories-allocation', tenantId] : ['my-stories-allocation', currentUser?.email],
        queryFn: async () => {
            if (isAdmin) {
                if (!tenantId) return [];
                return groonabackend.entities.Story.filter(
                    { tenant_id: tenantId },
                    '-updated_date'
                );
            }
            if (!currentUser?.email) return [];
            return groonabackend.entities.Story.list(); // We'll filter by assigned_to in memory
        },
        enabled: isAdmin ? !!tenantId : !!currentUser,
        staleTime: 60000,
    });

    // If admin, fetch tenant members
    const { data: members = [], isLoading: isLoadingMembers } = useQuery({
        queryKey: ['tenant-members-allocation-chart', tenantId],
        queryFn: async () => {
            if (!tenantId) return [];
            return groonabackend.entities.User.filter({ tenant_id: tenantId });
        },
        enabled: !!isAdmin && !!tenantId,
        staleTime: 5 * 60 * 1000,
    });

    const isLoading = isLoadingStories || (isAdmin && isLoadingMembers);

    const { targetPercentage, currentPercentage, topMembers = [] } = useMemo(() => {
        // Target is generally 80% allocation minimum for healthy resource usage
        const targetPercent = 80;
        const FIXED_CAPACITY_HOURS = 40; // Flat 40 hours standard capacity

        // Helper to calculate a user's workload percentage based on assigned stories
        const calculateWorkloadForEmail = (userEmail) => {
            if (!userEmail) return 0;
            const normalizedEmail = userEmail.toLowerCase();

            const assignedStories = stories.filter(s => {
                const assigned = s.assigned_to || [];
                if (Array.isArray(assigned)) {
                    return assigned.some(email => (email || '').toLowerCase() === normalizedEmail);
                }
                return (assigned || '').toLowerCase() === normalizedEmail;
            });

            // 1 story point = 2 hours
            const userLoadHours = assignedStories.reduce((sum, story) => {
                const points = Number(story.story_points) || 0;
                return sum + (points * 2);
            }, 0);

            return (userLoadHours / FIXED_CAPACITY_HOURS) * 100;
        };

        if (!isAdmin) {
            // Single user calculation
            const rawPercent = calculateWorkloadForEmail(currentUser?.email);
            return {
                targetPercentage: targetPercent,
                currentPercentage: Math.min(Math.round(rawPercent), 100),
                topMembers: []
            };
        }

        // Admin calculation (Team Average & Top Members)
        let totalRawPercentage = 0;
        let validMemberCount = 0;

        const calculatedMembers = members.map(member => {
            const rawPercent = calculateWorkloadForEmail(member.email);
            if (member.role !== 'client' && member.custom_role !== 'client') {
                totalRawPercentage += rawPercent;
                validMemberCount++;
            }
            return {
                ...member,
                rawAllocationPercent: rawPercent,
                allocationPercent: Math.round(rawPercent) // Don't cap at 100 for display ranking
            };
        });

        // Compute team average
        let teamAverageRaw = 0;
        if (validMemberCount > 0) {
            teamAverageRaw = totalRawPercentage / validMemberCount;
        }

        const topMembersList = calculatedMembers
            .filter(m => m.allocationPercent > 0 && m.role !== 'client' && m.custom_role !== 'client')
            .sort((a, b) => b.allocationPercent - a.allocationPercent)
            .slice(0, 5);

        return {
            targetPercentage: targetPercent,
            currentPercentage: Math.min(Math.round(teamAverageRaw), 100), // Cap the meter at 100%
            topMembers: topMembersList
        };
    }, [stories, currentUser, isAdmin, members]);

    // Segment generation for the semi-circle gauge (Mock Redesign)
    const segments = 32; // Fewer segments for a thicker pill look
    const innerRadius = 78; // Move closer to outer to just have straight pills
    const outerRadius = 92;
    const cx = 100;
    const cy = 100;

    // Create the segments
    const gaugePieces = Array.from({ length: segments }).map((_, i) => {
        const angleDeg = -180 + (i * (180 / (segments - 1)));
        const angleRad = (angleDeg * Math.PI) / 180;

        const x1 = cx + innerRadius * Math.cos(angleRad);
        const y1 = cy + innerRadius * Math.sin(angleRad);
        const x2 = cx + outerRadius * Math.cos(angleRad);
        const y2 = cy + outerRadius * Math.sin(angleRad);

        const percentFill = (i / (segments - 1)) * 100;
        const isFilled = percentFill <= currentPercentage;

        const strokeColor = isFilled ? '#22c55e' : '#f1f5f9'; // Vibrant green vs faint slate

        return (
            <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={strokeColor}
                strokeWidth="5"
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

            <CardContent className="px-6 pb-6 pt-4 flex flex-col">
                <div className="flex flex-col items-center justify-center pt-2">
                    {/* Gauge SVG Container */}
                    <div className="relative w-full max-w-[280px] mt-4 mb-2">
                        <svg viewBox="0 0 200 110" className="w-full overflow-visible">
                            {gaugePieces}
                        </svg>

                        {/* Centered Text Elements overlaid on the half-circle */}
                        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center justify-end text-center">
                            <span className="text-[52px] font-extrabold text-[#0f172a] tracking-tight leading-none mb-1">
                                {currentPercentage}%
                            </span>
                            <span className="text-[13px] font-bold text-slate-500">
                                On track for {targetPercentage}% target
                            </span>
                        </div>
                    </div>

                    <Link to={createPageUrl("ResourcePlanning")}>
                        <Button variant="outline" className="mt-2 mb-2 rounded-full border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold px-6 shadow-sm">
                            Show details
                        </Button>
                    </Link>
                </div>

                {/* Top 5 Overallocated Members List */}
                {isAdmin && topMembers.length > 0 && (
                    <div className="mt-2 flex flex-col pt-4 border-t border-slate-100">
                        <h4 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider mb-4">Top Weekly Allocation</h4>
                        <div className="space-y-4">
                            {topMembers.map((member, i) => (
                                <div key={member.id} className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8 ring-1 ring-black/5 bg-slate-100">
                                        <AvatarImage src={member.profile_picture || '/default-avatar.png'} />
                                        <AvatarFallback className="text-xs font-semibold text-slate-600">
                                            {member.full_name ? member.full_name.charAt(0).toUpperCase() : '?'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1 text-[13px]">
                                            <span className="font-semibold text-slate-900 truncate pr-2">
                                                {member.full_name || member.email}
                                            </span>
                                            <span className={`font-bold ${member.allocationPercent > 100 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {member.allocationPercent}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${member.allocationPercent > 100 ? 'bg-rose-500' : 'bg-emerald-500'
                                                    }`}
                                                style={{ width: `${Math.min(member.allocationPercent, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
