import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const STATUS_CONFIG = [
    { id: 'to_do', label: 'To Do', color: '#64748b', tailwind: 'bg-slate-500' }, // slate-500
    { id: 'in_progress', label: 'In Progress', color: '#2563eb', tailwind: 'bg-blue-600' }, // blue-600
    { id: 'review', label: 'In Review', color: '#f59e0b', tailwind: 'bg-amber-500' }, // amber-500
    { id: 'blocked', label: 'Blocked', color: '#ef4444', tailwind: 'bg-red-500' }, // red-500
    { id: 'completed', label: 'Completed', color: '#22c55e', tailwind: 'bg-green-500' } // green-500
];

export default function TaskOverviewDonutChart({ tasks = [], selectedStatus, onSelectStatus, title: propTitle, isAdmin }) {
    const title = propTitle || (isAdmin ? "Team Task Overview" : "Task Overview");

    // Derived stats
    const { counts, total, segments } = useMemo(() => {
        const c = { 'to_do': 0, 'in_progress': 0, 'review': 0, 'blocked': 0, 'completed': 0 };

        tasks.forEach(task => {
            const status = (task.status || 'to_do').toLowerCase();
            if (c[status] !== undefined) {
                c[status]++;
            } else {
                if (status === 'todo') c['to_do']++;
                else if (status === 'done') c['completed']++;
                else c['to_do']++;
            }
        });

        const tot = Object.values(c).reduce((sum, val) => sum + val, 0);

        // Chart SVG math
        let currentOffset = 0;
        const radius = 65;
        const circumference = 2 * Math.PI * radius;

        const segs = STATUS_CONFIG.map(config => {
            const count = c[config.id];
            const percentage = tot > 0 ? (count / tot) : 0;
            const strokeDasharray = `${percentage * circumference} ${circumference}`;
            const strokeDashoffset = -currentOffset;
            currentOffset += percentage * circumference;

            return {
                ...config,
                count,
                percentage: Math.round(percentage * 100),
                strokeDasharray,
                strokeDashoffset,
                radius
            };
        });

        return { counts: c, total: tot, segments: segs };
    }, [tasks]);

    return (
        <Card className="w-full flex flex-col bg-white border-0 shadow-sm ring-1 ring-slate-100/80 rounded-3xl overflow-hidden">
            <CardHeader className="p-6 pb-2">
                <CardTitle className="text-lg font-bold text-slate-900 tracking-tight">{title}</CardTitle>
            </CardHeader>

            <CardContent className="px-6 pb-10 pt-6 flex flex-col items-center flex-1">
                {total === 0 ? (
                    <div className="h-56 w-full flex items-center justify-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
                        <p className="text-sm text-slate-500 font-bold">No active tasks.</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        {/* Donut Chart Container */}
                        <div className="relative w-48 h-48 sm:w-56 sm:h-56 mb-8 flex items-center justify-center">
                            {/* Inner Typography */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-none tracking-tighter">
                                    {selectedStatus
                                        ? segments.find(s => s.id === selectedStatus)?.count
                                        : total}
                                </span>
                                <span className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-widest leading-none">
                                    {selectedStatus
                                        ? segments.find(s => s.id === selectedStatus)?.label
                                        : 'Total Tasks'}
                                </span>
                            </div>

                            {/* SVG Donut */}
                            <svg width="100%" height="100%" viewBox="0 0 160 160" className="rotate-[-90deg] overflow-visible">
                                {segments.map((seg, i) => {
                                    if (seg.count === 0) return null;
                                    const isSelected = selectedStatus === seg.id;
                                    const isDimmed = selectedStatus && !isSelected;

                                    return (
                                        <motion.circle
                                            key={seg.id}
                                            cx="80"
                                            cy="80"
                                            r={seg.radius}
                                            fill="transparent"
                                            stroke={seg.color}
                                            strokeWidth={isSelected ? 26 : 20}
                                            strokeDasharray={seg.strokeDasharray}
                                            strokeDashoffset={seg.strokeDashoffset}
                                            strokeLinecap="round"
                                            className={cn(
                                                "transition-all duration-300 cursor-pointer origin-center hover:opacity-90 outline-none shadow-sm",
                                                isDimmed ? "opacity-30" : "opacity-100"
                                            )}
                                            onClick={() => onSelectStatus(isSelected ? null : seg.id)}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: isDimmed ? 0.3 : 1, scale: 1 }}
                                            transition={{ delay: i * 0.1, duration: 0.6, type: 'spring', bounce: 0.4 }}
                                        />
                                    );
                                })}
                            </svg>
                        </div>

                        {/* Interactive Legend (Apple-style Pills) */}
                        <div className="flex flex-wrap justify-center gap-2.5">
                            {segments.map((seg) => {
                                if (seg.count === 0) return null;
                                const isSelected = selectedStatus === seg.id;
                                const isDimmed = selectedStatus && !isSelected;

                                return (
                                    <button
                                        key={seg.id}
                                        onClick={() => onSelectStatus(isSelected ? null : seg.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 border focus:outline-none",
                                            isSelected
                                                ? `bg-slate-50 border-slate-200 text-slate-900 shadow-sm scale-110 z-10 font-extrabold`
                                                : isDimmed
                                                    ? "bg-transparent border-transparent text-slate-400 opacity-60"
                                                    : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50 hover:border-slate-200 shadow-sm"
                                        )}
                                    >
                                        <div
                                            className={cn("w-2.5 h-2.5 rounded-full shadow-sm", seg.tailwind)}
                                            style={{ backgroundColor: seg.color }}
                                        />
                                        {seg.label}
                                        <span className="opacity-60 font-medium ml-1">{seg.percentage}%</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
