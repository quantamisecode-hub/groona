import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { groonabackend } from '@/api/groonabackend';
import { useUser } from '@/components/shared/UserContext';
import { Banknote, TrendingUp, UserCheck, Star, BadgeCheck, DollarSign, Loader2, ArrowUpRight, User } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function AdminTopPerformers({ tasks: propTasks = null, projects: propProjects = null }) {
    const { user: currentUser, effectiveTenantId } = useUser();

    const { data: fetchProjects = [], isLoading: pLoading } = useQuery({
        queryKey: ['prof-projects', effectiveTenantId],
        queryFn: () => groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId }),
        enabled: !!currentUser && !!effectiveTenantId && !propProjects,
    });
    const projects = propProjects || fetchProjects;

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

    const { data: fetchTasks = [], isLoading: tsLoading } = useQuery({
        queryKey: ['prof-tasks', effectiveTenantId],
        queryFn: async () => {
            if (!effectiveTenantId) return groonabackend.entities.Task.list();
            return groonabackend.entities.Task.filter({ tenant_id: effectiveTenantId });
        },
        enabled: !!currentUser && !!effectiveTenantId && !propTasks,
    });
    const tasks = propTasks || fetchTasks;

    const isLoading = (!propProjects && pLoading) || uLoading || tLoading || eLoading || (!propTasks && tsLoading);

    const { topProjects, topUsers } = useMemo(() => {
        if (!projects.length || !users.length) return { topProjects: [], topUsers: [] };

        // --- Calculate Top Projects ---
        const projectStats = {};
        projects.forEach(p => {
            let revenueAmount = 0;
            switch (p.billing_model) {
                case 'fixed_price':
                    revenueAmount = Number(p.contract_amount || p.budget || 0);
                    break;
                case 'retainer':
                    revenueAmount = Number(p.retainer_amount || p.contract_amount || p.budget || 0);
                    break;
                case 'time_and_materials': {
                    const duration = Number(p.estimated_duration || 0);
                    const rate = Number(p.default_bill_rate_per_hour || 0);
                    revenueAmount = duration * rate;
                    break;
                }
                case 'non_billable':
                    revenueAmount = 0;
                    break;
                default:
                    revenueAmount = Number(p.contract_amount || p.budget || 0);
            }
            projectStats[p.id] = { id: p.id, name: p.name, revenue: revenueAmount, laborCost: 0, expense: 0, profit: 0, margin: 0 };
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
        }).filter(p => p.totalCost > 0).sort((a, b) => b.margin - a.margin).slice(0, 3); // 🥇 Top 3 by profit margin

        // --- Calculate Top Team Members ---
        // Top users by completed tasks
        const userStats = {};
        users.forEach(u => {
            userStats[u.email] = { name: u.full_name || u.email, email: u.email, completedTasksCount: 0 };
        });

        tasks.forEach(task => {
            if (task.status === 'completed') {
                const assignees = Array.isArray(task.assigned_to) ? task.assigned_to : (task.assigned_to ? [task.assigned_to] : []);
                assignees.forEach(email => {
                    if (userStats[email]) {
                        userStats[email].completedTasksCount += 1;
                    }
                });
            }
        });

        let topUsersArray = Object.values(userStats)
            .filter(u => u.completedTasksCount > 0)
            .sort((a, b) => b.completedTasksCount - a.completedTasksCount)
            .slice(0, 3);

        return { topProjects: topProjectsArray, topUsers: topUsersArray };
    }, [projects, users, timesheets, expenses, tasks]);

    if (isLoading) {
        return (
            <div className="w-full bg-white border border-slate-100 rounded-[32px] p-8 flex items-center justify-center min-h-[200px] shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
        );
    }

    const formatCurrency = (amount) => {
        if (Math.abs(amount) >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
        return `₹${amount.toFixed(0)}`;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full mt-6">

            {/* Top Projects Leaderboard */}
            <div className="bg-white border border-slate-100/80 rounded-[32px] p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative overflow-hidden group">
                {/* Decorative Background */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-50 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"></div>

                <div className="flex justify-between items-center mb-8 relative z-10">
                    <div>
                        <h3 className="text-[18px] font-bold text-slate-900 tracking-tight">Most Profitable Projects</h3>
                        <p className="text-[14px] text-slate-500 mt-1 font-medium">Ranked by net margin</p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Banknote className="w-5 h-5" />
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
            <div className="bg-white border border-slate-100/80 rounded-[32px] p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative overflow-hidden group">
                {/* Decorative Background */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"></div>

                <div className="flex justify-between items-center mb-8 relative z-10">
                    <div>
                        <h3 className="text-[18px] font-bold text-slate-900 tracking-tight">Top Performing Members</h3>
                        <p className="text-[14px] text-slate-500 mt-1 font-medium">Ranked by completed tasks</p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <User className="w-5 h-5" />
                    </div>
                </div>

                <div className="flex flex-col gap-4 relative z-10">
                    {topUsers.map((user, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-slate-100/50 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-700'}`}>
                                    #{idx + 1}
                                </div>
                                <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm border border-slate-100">
                                    <AvatarImage src={user.profile_picture || '/default-avatar.png'} />
                                    <AvatarFallback className="text-sm font-bold text-slate-600 bg-slate-100">
                                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-900 text-[15px] max-w-[150px] truncate">{user.name}</span>
                                    <span className="text-[13px] font-medium text-slate-500 flex items-center gap-1">
                                        <BadgeCheck className="w-3.5 h-3.5 text-indigo-500" />
                                        Task Champion
                                    </span>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <div className="flex items-center gap-1 font-bold text-slate-900 text-[16px]">
                                    {user.completedTasksCount}
                                    <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                                </div>
                                <span className="text-[12px] font-medium text-slate-400">Tasks Completed</span>
                            </div>
                        </div>
                    ))}
                    {topUsers.length === 0 && (
                        <div className="text-sm text-slate-500 text-center py-4">Not enough task data yet.</div>
                    )}
                </div>
            </div>

        </div>
    );
}
