import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { groonabackend } from '@/api/groonabackend';
import { useUser } from '@/components/shared/UserContext';
import { Trophy, TrendingUp, UserCheck, Star, BadgeCheck, DollarSign, Loader2, ArrowUpRight } from "lucide-react";

export default function AdminTopPerformers() {
    const { user: currentUser, effectiveTenantId } = useUser();

    const { data: projects = [], isLoading: pLoading } = useQuery({
        queryKey: ['prof-projects', effectiveTenantId],
        queryFn: () => groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId }),
        enabled: !!currentUser && !!effectiveTenantId,
    });

    const { data: users = [], isLoading: uLoading } = useQuery({
        queryKey: ['prof-users', effectiveTenantId],
        queryFn: async () => {
            const all = await groonabackend.entities.User.list();
            return all.filter(u => u.tenant_id === effectiveTenantId);
        },
        enabled: !!currentUser && !!effectiveTenantId,
    });

    const { data: timesheets = [], isLoading: tLoading } = useQuery({
        queryKey: ['prof-timesheets', effectiveTenantId],
        queryFn: () => groonabackend.entities.Timesheet.filter({ tenant_id: effectiveTenantId }),
        enabled: !!currentUser && !!effectiveTenantId,
    });

    const { data: expenses = [], isLoading: eLoading } = useQuery({
        queryKey: ['prof-expenses', effectiveTenantId],
        queryFn: () => groonabackend.entities.ProjectExpense.filter({ tenant_id: effectiveTenantId }),
        enabled: !!currentUser && !!effectiveTenantId,
    });

    const isLoading = pLoading || uLoading || tLoading || eLoading;

    const { topProjects, topUsers } = useMemo(() => {
        if (!projects.length || !users.length) return { topProjects: [], topUsers: [] };

        // --- Calculate Top Projects ---
        const projectStats = {};
        projects.forEach(p => {
            const budget = Number(p.budget || p.contract_amount || p.retainer_amount || 0);
            projectStats[p.id] = { id: p.id, name: p.name, revenue: budget, laborCost: 0, expense: 0, profit: 0, margin: 0 };
        });

        const userRates = {};
        users.forEach(u => { userRates[u.email] = Number(u.hourly_rate || 0); });

        timesheets.forEach(t => {
            if (t.status === 'approved' && t.is_billable) {
                const projectId = typeof t.project_id === 'object' ? t.project_id.id : t.project_id;
                if (projectStats[projectId]) {
                    const rate = t.snapshot_hourly_rate || t.hourly_rate || userRates[t.user_email] || 0;
                    projectStats[projectId].laborCost += ((t.total_minutes || 0) / 60) * rate;
                }
            }
        });

        expenses.forEach(e => {
            if (e.status === 'approved') {
                const projectId = typeof e.project_id === 'object' ? e.project_id.id : e.project_id;
                if (projectStats[projectId]) {
                    projectStats[projectId].expense += Number(e.amount || 0);
                }
            }
        });

        let topProjectsArray = Object.values(projectStats).map(p => {
            p.totalCost = p.laborCost + p.expense;
            p.profit = p.revenue - p.totalCost;
            p.margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
            return p;
        }).sort((a, b) => b.margin - a.margin).slice(0, 3); // 🥇 Top 3 by profit margin

        // --- Calculate Top Team Members ---
        // Efficiency = Billable Hours
        const userStats = {};
        users.forEach(u => {
            userStats[u.email] = { name: u.full_name || u.email, email: u.email, billableMinutes: 0, totalMinutes: 0, generatedValue: 0 };
        });

        timesheets.forEach(t => {
            if (t.status === 'approved') {
                const email = t.user_email;
                if (userStats[email]) {
                    userStats[email].totalMinutes += (t.total_minutes || 0);
                    if (t.is_billable) {
                        userStats[email].billableMinutes += (t.total_minutes || 0);
                        const rate = t.snapshot_hourly_rate || t.hourly_rate || userRates[email] || 0;
                        userStats[email].generatedValue += ((t.total_minutes || 0) / 60) * rate;
                    }
                }
            }
        });

        let topUsersArray = Object.values(userStats).map(u => {
            u.efficiency = u.totalMinutes > 0 ? (u.billableMinutes / u.totalMinutes) * 100 : 0;
            u.billableHours = u.billableMinutes / 60;
            return u;
        }).sort((a, b) => b.generatedValue - a.generatedValue).slice(0, 3); // 🥇 Top 3 by generated billable value

        return { topProjects: topProjectsArray, topUsers: topUsersArray };
    }, [projects, users, timesheets, expenses]);

    if (isLoading) {
        return (
            <div className="w-full bg-white border border-slate-100 rounded-[32px] p-8 flex items-center justify-center min-h-[200px] shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!topProjects.length && !topUsers.length) return null;

    const formatCurrency = (amount) => {
        if (Math.abs(amount) >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
        return `₹${amount.toFixed(0)}`;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full mt-6">

            {/* Top Projects Leaderboard */}
            <div className="bg-white border border-slate-100/80 rounded-[32px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative overflow-hidden group">
                {/* Decorative Background */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-50 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"></div>

                <div className="flex justify-between items-center mb-8 relative z-10">
                    <div>
                        <h3 className="text-[18px] font-bold text-slate-900 tracking-tight">Most Profitable Projects</h3>
                        <p className="text-[14px] text-slate-500 mt-1 font-medium">Ranked by net margin</p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Trophy className="w-5 h-5" />
                    </div>
                </div>

                <div className="flex flex-col gap-4 relative z-10">
                    {topProjects.map((project, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-slate-100/50 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-700'}`}>
                                    #{idx + 1}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-900 text-[15px]">{project.name}</span>
                                    <span className="text-[13px] font-medium text-slate-500 flex items-center gap-1">
                                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                                        {project.margin.toFixed(1)}% margin
                                    </span>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <span className="font-bold text-slate-900 text-[16px]">{formatCurrency(project.profit)}</span>
                                <span className="text-[12px] font-medium text-slate-400">Net Profit</span>
                            </div>
                        </div>
                    ))}
                    {topProjects.length === 0 && (
                        <div className="text-sm text-slate-500 text-center py-4">Not enough financial data yet.</div>
                    )}
                </div>
            </div>

            {/* Top Team Members Leaderboard */}
            <div className="bg-white border border-slate-100/80 rounded-[32px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative overflow-hidden group">
                {/* Decorative Background */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"></div>

                <div className="flex justify-between items-center mb-8 relative z-10">
                    <div>
                        <h3 className="text-[18px] font-bold text-slate-900 tracking-tight">Top Performing Members</h3>
                        <p className="text-[14px] text-slate-500 mt-1 font-medium">Ranked by billable value</p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Star className="w-5 h-5" />
                    </div>
                </div>

                <div className="flex flex-col gap-4 relative z-10">
                    {topUsers.map((user, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-slate-100/50 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-700'}`}>
                                    #{idx + 1}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-900 text-[15px] max-w-[150px] truncate">{user.name}</span>
                                    <span className="text-[13px] font-medium text-slate-500 flex items-center gap-1">
                                        <BadgeCheck className="w-3.5 h-3.5 text-indigo-500" />
                                        {user.billableHours.toFixed(1)} billable hrs
                                    </span>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <div className="flex items-center gap-1 font-bold text-slate-900 text-[16px]">
                                    {formatCurrency(user.generatedValue)}
                                    <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                                </div>
                                <span className="text-[12px] font-medium text-slate-400">Value Generated</span>
                            </div>
                        </div>
                    ))}
                    {topUsers.length === 0 && (
                        <div className="text-sm text-slate-500 text-center py-4">Not enough timesheet data yet.</div>
                    )}
                </div>
            </div>

        </div>
    );
}
