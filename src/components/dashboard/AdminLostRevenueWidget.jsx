import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { groonabackend } from '@/api/groonabackend';
import { useUser } from '@/components/shared/UserContext';
import { AlertTriangle, Clock, Banknote, Search, CalendarClock } from "lucide-react";

export default function AdminLostRevenueWidget() {
    const { user: currentUser, effectiveTenantId } = useUser();

    // Fetch projects to map names
    const { data: projects = [], isLoading: pLoading } = useQuery({
        queryKey: ['revenue-projects', effectiveTenantId],
        queryFn: () => groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId }),
        enabled: !!currentUser && !!effectiveTenantId,
    });

    // Fetch users to map rates
    const { data: users = [], isLoading: uLoading } = useQuery({
        queryKey: ['revenue-users', effectiveTenantId],
        queryFn: async () => {
            const all = await groonabackend.entities.User.list();
            return all.filter(u => u.tenant_id === effectiveTenantId);
        },
        enabled: !!currentUser && !!effectiveTenantId,
    });

    // Fetch timesheets to find 'pending' ones
    const { data: timesheets = [], isLoading: tLoading } = useQuery({
        queryKey: ['revenue-timesheets', effectiveTenantId],
        queryFn: () => groonabackend.entities.Timesheet.filter({ tenant_id: effectiveTenantId }),
        enabled: !!currentUser && !!effectiveTenantId,
    });

    // Fetch expenses to find 'pending' ones
    const { data: expenses = [], isLoading: eLoading } = useQuery({
        queryKey: ['revenue-expenses', effectiveTenantId],
        queryFn: () => groonabackend.entities.ProjectExpense.filter({ tenant_id: effectiveTenantId }),
        enabled: !!currentUser && !!effectiveTenantId,
    });

    const isLoading = pLoading || uLoading || tLoading || eLoading;

    const { pendingRevenue, pendingHours, pendingExpenses, topPendingProjects } = useMemo(() => {
        if (!projects.length || !users.length) return { pendingRevenue: 0, pendingHours: 0, pendingExpenses: 0, topPendingProjects: [] };

        let totalPendingRevenue = 0;
        let totalPendingHours = 0;
        let totalPendingExpenseAmount = 0;

        const userRates = {};
        users.forEach(u => { userRates[u.email] = Number(u.hourly_rate || 0); });

        const projectMap = {};
        projects.forEach(p => {
            projectMap[p.id] = { id: p.id, name: p.name, pendingAmount: 0, unapprovedItems: 0 };
        });

        // 1. Calculate unapproved Timesheets (only billable ones that translate to revenue)
        timesheets.forEach(t => {
            if (t.status === 'pending' || t.status === 'submitted') {
                const projectId = typeof t.project_id === 'object' ? t.project_id.id : t.project_id;
                const rate = t.snapshot_hourly_rate || t.hourly_rate || userRates[t.user_email] || 0;

                const hours = (t.total_minutes || 0) / 60;
                totalPendingHours += hours;

                if (t.is_billable) {
                    const value = hours * rate;
                    totalPendingRevenue += value;

                    if (projectMap[projectId]) {
                        projectMap[projectId].pendingAmount += value;
                        projectMap[projectId].unapprovedItems += 1;
                    }
                }
            }
        });

        // 2. Calculate unapproved Expenses
        expenses.forEach(e => {
            if (e.status === 'pending' || e.status === 'submitted') {
                const projectId = typeof e.project_id === 'object' ? e.project_id.id : e.project_id;
                const value = Number(e.amount || 0);

                totalPendingExpenseAmount += value;
                totalPendingRevenue += value; // Assuming billable expenses are part of revenue

                if (projectMap[projectId]) {
                    projectMap[projectId].pendingAmount += value;
                    projectMap[projectId].unapprovedItems += 1;
                }
            }
        });

        const sortedProjects = Object.values(projectMap)
            .filter(p => p.pendingAmount > 0)
            .sort((a, b) => b.pendingAmount - a.pendingAmount)
            .slice(0, 3); // Top 3 offenders

        return {
            pendingRevenue: totalPendingRevenue,
            pendingHours: totalPendingHours,
            pendingExpenses: totalPendingExpenseAmount,
            topPendingProjects: sortedProjects
        };
    }, [projects, users, timesheets, expenses]);

    if (isLoading) return null; // Or a sleek skeleton

    // If there is no pending revenue, hide the widget entirely to keep the dashboard clean
    if (pendingRevenue === 0) return null;

    const formatCurrency = (amount) => {
        if (Math.abs(amount) >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
        return `₹${amount.toFixed(0)}`;
    };

    return (
        <div className="bg-red-50 border border-red-200 rounded-[32px] p-8 shadow-[0_8px_30px_rgb(225,29,72,0.03)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full blur-[80px] opacity-60 -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

            <div className="flex flex-col lg:flex-row gap-8 items-stretch relative z-10">

                {/* Left Side: The "Shock" Number */}
                <div className="lg:w-1/3 flex flex-col justify-center border-r border-slate-100 pr-8">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                        <h3 className="text-[16px] font-bold text-slate-900 tracking-tight">Unrealized Revenue</h3>
                    </div>

                    <div className="text-[48px] font-extrabold text-rose-600 tracking-tighter leading-none mb-3">
                        {formatCurrency(pendingRevenue)}
                    </div>
                    <p className="text-[13px] text-slate-500 leading-relaxed font-medium">
                        Value of unapproved timesheets and expenses currently awaiting PM approval.
                    </p>
                </div>

                {/* Right Side: The Breakdown & Offenders */}
                <div className="lg:w-2/3 flex flex-col justify-center pl-4">
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <div className="flex-1 bg-white border border-red-100 shadow-[0_2px_8px_rgb(225,29,72,0.04)] rounded-2xl p-4 flex items-center gap-4 transition-all hover:shadow-[0_4px_12px_rgb(225,29,72,0.08)]">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center border border-orange-100/50">
                                <Clock className="w-4 h-4" strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pending Time</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-[22px] font-extrabold text-slate-900 tracking-tight leading-none">{pendingHours.toFixed(1)}</span>
                                    <span className="text-[13px] font-semibold text-slate-500">hrs</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 bg-white border border-red-100 shadow-[0_2px_8px_rgb(225,29,72,0.04)] rounded-2xl p-4 flex items-center gap-4 transition-all hover:shadow-[0_4px_12px_rgb(225,29,72,0.08)]">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center border border-indigo-100/50">
                                <Banknote className="w-4 h-4" strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pending Expenses</span>
                                <span className="text-[22px] font-extrabold text-slate-900 tracking-tight leading-none">{formatCurrency(pendingExpenses)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/80 border border-red-100 rounded-2xl p-5 shadow-[0_2px_8px_rgb(225,29,72,0.02)]">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Top Offenders (Projects)</span>
                            <div className="p-1.5 bg-red-50 rounded-lg">
                                <Search className="w-3.5 h-3.5 text-red-500" strokeWidth={2.5} />
                            </div>
                        </div>

                        <div className="space-y-3.5">
                            {topPendingProjects.map((project, idx) => (
                                <div key={project.id} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400 group-hover:scale-150 transition-transform"></div>
                                        <span className="text-[14px] font-bold text-slate-800">{project.name}</span>
                                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                            {project.unapprovedItems} {project.unapprovedItems === 1 ? 'item' : 'items'}
                                        </span>
                                    </div>
                                    <span className="text-[14px] font-bold text-rose-600">{formatCurrency(project.pendingAmount)}</span>
                                </div>
                            ))}
                            {topPendingProjects.length === 0 && (
                                <div className="text-[13px] text-slate-500 font-medium italic">No major offenders found.</div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
