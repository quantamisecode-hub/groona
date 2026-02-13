import React, { useState, useMemo, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ArrowLeft, Loader2, Download, Filter, Wallet, Users, Banknote, TrendingUp, Building2, User, Activity, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO, differenceInMonths, differenceInWeeks, differenceInYears } from "date-fns";
import axios from 'axios';
import TaskDetailDialog from "@/components/tasks/TaskDetailDialog";
import AIInsightsModal from "@/components/profitability/AIInsightsModal";
import { useUser } from "@/components/shared/UserContext";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ProjectProfitabilityDetail() {
    const [searchParams] = useSearchParams();
    const projectId = searchParams.get("projectId");
    const navigate = useNavigate();

    const [fromDate, setFromDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [toDate, setToDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [targetCurrency, setTargetCurrency] = useState("INR");
    const [conversionRates, setConversionRates] = useState({});
    const [isLoadingRates, setIsLoadingRates] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);

    const { user: currentUser } = useUser();

    // Fetch Project Details
    const { data: project, isLoading: loadingProject } = useQuery({
        queryKey: ["project", projectId],
        queryFn: async () => {
            // Fallback: Use list/filter since .get() is not available
            if (!projectId) return null;
            // Try filter if backend supports it efficiently
            try {
                const res = await groonabackend.entities.Project.filter({ _id: projectId });
                if (res && res.length > 0) return res[0];
                // Fallback to simple list filter if backend filter is limited
                const all = await groonabackend.entities.Project.list();
                return all.find(p => p.id === projectId || p._id === projectId);
            } catch (e) {
                const all = await groonabackend.entities.Project.list();
                return all.find(p => p.id === projectId || p._id === projectId);
            }
        },
        enabled: !!projectId,
    });

    // Fetch Client Details
    const { data: client } = useQuery({
        queryKey: ["client", project?.client],
        queryFn: async () => {
            if (!project?.client) return null;
            const all = await groonabackend.entities.Client.list();
            return all.find(c => c.id === project.client);
        },
        enabled: !!project?.client,
    });

    const { data: clientUser } = useQuery({
        queryKey: ["clientUser", project?.client_user_id],
        queryFn: async () => {
            if (!project?.client_user_id) return null;
            const all = await groonabackend.entities.User.list();
            return all.find(u => u.id === project.client_user_id);
        },
        enabled: !!project?.client_user_id,
    });

    // Fetch Timesheets
    const { data: timesheets = [], isLoading: loadingTimesheets } = useQuery({
        queryKey: ["timesheets", projectId],
        queryFn: async () => {
            const all = await groonabackend.entities.Timesheet.list();
            return all.filter(t => {
                const tPid = typeof t.project_id === 'object' ? t.project_id.id : t.project_id;
                return tPid === projectId;
            });
        },
        enabled: !!projectId,
    });

    // Fetch Project Expenses
    const { data: expenses = [] } = useQuery({
        queryKey: ["project-expenses", projectId],
        queryFn: async () => {
            const all = await groonabackend.entities.ProjectExpense.list();
            return all.filter(e => {
                const ePid = typeof e.project_id === 'object' ? e.project_id.id : e.project_id;
                return ePid === projectId;
            });
        },
        enabled: !!projectId,
    });

    // Fetch Users to get Hourly Rates
    const { data: users = [] } = useQuery({
        queryKey: ["users"],
        queryFn: () => groonabackend.entities.User.list(),
    });

    // Fetch Tasks & Sprints for granular breakdown
    const { data: tasks = [] } = useQuery({
        queryKey: ["tasks", projectId],
        queryFn: async () => {
            const all = await groonabackend.entities.Task.list();
            return all.filter(t => {
                const tPid = typeof t.project_id === 'object' ? t.project_id.id : t.project_id;
                return tPid === projectId;
            });
        },
        enabled: !!projectId,
    });
    const { data: sprints = [] } = useQuery({
        queryKey: ["sprints", projectId],
        queryFn: async () => {
            const all = await groonabackend.entities.Sprint.list();
            return all.filter(s => {
                const sPid = typeof s.project_id === 'object' ? s.project_id.id : s.project_id;
                return sPid === projectId;
            });
        }
    });

    // Fetch Exchange Rates
    useEffect(() => {
        const fetchRates = async () => {
            if (!project) return;
            // Identify currencies involved: Project Currency, User Currencies, Expense Currencies
            const currencies = new Set();
            if (project.currency) currencies.add(project.currency);
            users.forEach(u => { if (u.ctc_currency) currencies.add(u.ctc_currency); }); // User preferred currency
            expenses.forEach(e => { if (e.currency) currencies.add(e.currency); });

            // We need rates to convert FROM these TO Target Currency
            const sources = [...currencies].filter(c => c && c !== targetCurrency);
            if (sources.length === 0) return;

            setIsLoadingRates(true);
            const newRates = { ...conversionRates };

            try {
                await Promise.all(sources.map(async (source) => {
                    const key = `${source}_${targetCurrency}`;
                    if (newRates[key]) return;

                    const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
                    const response = await axios.get(`${apiBase}/api/currency/convert`, {
                        params: { from: source, to: targetCurrency, amount: 1 }
                    });
                    if (response.data.rate) {
                        newRates[key] = response.data.rate;
                    }
                }));
                setConversionRates(newRates);
            } catch (err) {
                console.error("Failed rate fetch", err);
            } finally {
                setIsLoadingRates(false);
            }
        };
        fetchRates();
    }, [project, users, expenses, targetCurrency]);

    const getConvertedAmount = (amount, sourceCurrency) => {
        if (!amount) return 0;
        if (!sourceCurrency || sourceCurrency === targetCurrency) return amount;
        const key = `${sourceCurrency}_${targetCurrency}`;
        const rate = conversionRates[key];
        return rate ? amount * rate : amount;
    };

    // Helper to get rate A->B (Handling User->Project)
    const getRate = (from, to) => {
        if (from === to) return 1;
        // We convert everything via Target Currency
        const getRateToTarget = (c) => {
            if (c === targetCurrency) return 1;
            return conversionRates[`${c}_${targetCurrency}`] || 0;
        };

        const rateFrom = getRateToTarget(from);
        const rateTo = getRateToTarget(to);

        if (rateFrom && rateTo) {
            return rateFrom / rateTo;
        }
        return 1; // Fallback if rates missing
    };

    const formatCurrency = (amount, currency) => {
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency || 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(amount);
        } catch {
            return `${currency} ${amount?.toFixed(0)}`;
        }
    };

    // Process Data
    const reportData = useMemo(() => {
        if (!timesheets.length && !expenses.length) return [];

        const rows = [];

        // 1. Labor Costs (Timesheets)
        // Grouped by User + Sprint + Task
        const laborMap = {};

        timesheets.forEach(t => {
            const tDate = t.date?.$date ? t.date.$date : t.date;
            const dateStr = format(new Date(tDate), 'yyyy-MM-dd');
            if (dateStr < fromDate || dateStr > toDate) return;

            const key = `${t.user_email}_${t.sprint_id}_${t.task_id}`;
            if (!laborMap[key]) {
                const user = users.find(u => u.email === t.user_email);
                const task = tasks.find(tsk => tsk.id === t.task_id);
                const sprint = sprints.find(s => s.id === t.sprint_id);
                laborMap[key] = {
                    type: 'labor',
                    sprintName: sprint ? sprint.name : 'General / Backlog',
                    taskTitle: task ? task.title : 'General Task',
                    taskId: task ? task.id : null,
                    employeeName: user ? user.full_name : t.user_email,
                    userEmail: t.user_email,
                    userHourlyRate: user ? (user.hourly_rate || 0) : 0,
                    userCurrency: user?.ctc_currency || 'INR', // Default to INR if missing
                    loggedHours: 0,
                    approvedHours: 0,
                    nonBillableHours: 0, // Track non-billable
                    cost: 0,
                    originalCostAcc: 0, // In User Currency (for badge display)
                    lastSnapshotRate: 0,
                    lastSnapshotOriginalRate: 0,
                    lastDate: ''
                };
            }

            const row = laborMap[key];
            row.loggedHours += (t.total_minutes || 0) / 60;
            if (dateStr > row.lastDate) row.lastDate = dateStr;

            // Rate Logic
            // Prioritize Snapshot (New Field -> Old Field), Fallback to Profile ONLY if missing (undefined/null)
            // Rate Logic - Strictly prefer snapshot
            // Prioritize snapshot_hourly_rate (Original Rate in User Currency captured at logging time)
            // Rate Logic - Strictly prefer snapshot
            // Prioritize snapshot_hourly_rate (Original Rate in User Currency captured at logging time)
            let currentRateRaw = 0;
            // Ensure we handle string/number conversion safely and check for null/undefined/0
            if (t.snapshot_hourly_rate !== undefined && t.snapshot_hourly_rate !== null && Number(t.snapshot_hourly_rate) > 0) {
                currentRateRaw = Number(t.snapshot_hourly_rate);
            } else if (t.snapshot_rate !== undefined && t.snapshot_rate !== null && Number(t.snapshot_rate) > 0) {
                currentRateRaw = Number(t.snapshot_rate);
            } else if (t.hourly_rate !== undefined && t.hourly_rate !== null && Number(t.hourly_rate) > 0) {
                currentRateRaw = Number(t.hourly_rate);
            } else {
                currentRateRaw = row.userHourlyRate;
            }

            // Accumulate Original Cost in User/Source Currency (for accurate badge and Original Cost column)
            if (t.status === 'approved' && t.is_billable) {
                // Ideally use snapshot_total_cost if available for precision
                if (t.snapshot_total_cost !== undefined && t.snapshot_total_cost !== null) {
                    row.originalCostAcc += Number(t.snapshot_total_cost);
                } else {
                    row.originalCostAcc += ((t.total_minutes || 0) / 60) * currentRateRaw;
                }
            }

            // Calculate Effective Rate in Project Currency
            const projectCurrency = project?.currency || 'INR';
            const conversionRate = getRate(row.userCurrency, projectCurrency);
            const effectiveRateProjectCurrency = currentRateRaw * conversionRate;

            // Update last known rate (if present in timesheet)
            // Update last known rate (if present in timesheet)
            if (effectiveRateProjectCurrency > 0) {
                if (!row.lastSnapshotRate || row.lastSnapshotRate === 0) {
                    row.lastSnapshotRate = effectiveRateProjectCurrency;
                }
                if (!row.lastSnapshotOriginalRate || row.lastSnapshotOriginalRate === 0) {
                    row.lastSnapshotOriginalRate = currentRateRaw;
                }
            }

            if (!t.is_billable) {
                row.nonBillableHours += (t.total_minutes || 0) / 60;
            } else if (t.status === 'approved') {
                row.approvedHours += (t.total_minutes || 0) / 60;
                row.cost += ((t.total_minutes || 0) / 60) * effectiveRateProjectCurrency;
            }
        });

        // 2. Non-Labor Costs (Expenses)
        const expenseRows = expenses.filter(e => {
            if (e.status !== 'approved') return false;
            const eDate = e.date;
            return eDate >= fromDate && eDate <= toDate;
        }).map(e => ({
            type: 'expense',
            sprintName: '-',
            taskTitle: e.description || e.category,
            employeeName: 'project', // or user who created it
            loggedHours: 0,
            approvedHours: 0,
            nonBillableHours: 0,
            hourlyRate: 0,
            cost: getConvertedAmount(e.amount, e.currency), // Convert Expense Currency -> Target? 
            // Wait, standard practice: Convert Expense -> Project Currency for "Original Cost" column?
            // "Original Cost" usually means "In Project Currency". 
            // If e.currency != project.currency, we should convert e.currency -> project.currency.
            // Let's retry:
            originalCostInProjectCurrency: getConvertedAmount(e.amount, e.currency) // This converts to TARGET.
            // We need a way to convert to PROJECT currency for consistent "Cost" column if table shows PROJECT currency values.
            // The table "Original Cost" column probably implies Project Currency.
            // Let's assume calculate in Target currency for reports, but raw cost?
        }));

        // Convert Expense Cost to Project Currency if possible, else Target
        const projectCurrency = project?.currency || 'INR';

        const finalLaborRows = Object.values(laborMap).map(r => {
            // Finalize Rate: Weighted Avg or Last Snapshot or Profile
            let displayRate = r.approvedHours > 0 ? (r.cost / r.approvedHours) : r.lastSnapshotRate;
            if (!displayRate) displayRate = r.userHourlyRate * getRate(r.userCurrency, projectCurrency);

            // Finalize Original Rate (for Badge)
            let displayOriginalRate = r.approvedHours > 0 ? (r.originalCostAcc / r.approvedHours) : r.lastSnapshotOriginalRate;
            if (!displayOriginalRate) displayOriginalRate = r.userHourlyRate;

            return {
                ...r,
                hourlyRate: displayRate,
                originalRate: displayOriginalRate,
                currency: projectCurrency,
                sprint: r.sprintName, // Mapping for table
                task: r.taskTitle,
                employee: r.employeeName,
                logged: r.loggedHours,
                approvedBillable: r.approvedHours,
                nonBillable: r.nonBillableHours,
                originalAmount: r.originalCostAcc,
                originalCurrency: r.userCurrency
            };
        }).sort((a, b) => b.lastDate.localeCompare(a.lastDate)); // Newest First

        const finalExpenseRows = expenses.filter(e => {
            if (e.status !== 'approved') return false;
            const eDate = e.date;
            return eDate >= fromDate && eDate <= toDate;
        }).map(e => {
            // Convert to Project Currency for correct "Original Cost" display alongside labor
            const convRate = getRate(e.currency, projectCurrency);
            const costInProject = (e.amount || 0) * convRate;
            return {
                type: 'expense',
                sprint: '-',
                task: e.description || e.category,
                employee: e.vendor || 'Expense',
                logged: 0,
                approvedBillable: 0,
                nonBillable: 0,
                hourlyRate: 0,
                cost: costInProject,
                currency: projectCurrency,
                originalAmount: e.amount,
                originalCurrency: e.currency
            };
        });

        return [...finalLaborRows, ...finalExpenseRows];
    }, [timesheets, expenses, users, tasks, sprints, fromDate, toDate, conversionRates, project]);

    // Calculate Totals by Type from Report Data
    const { totalLaborCost, totalNonLaborCost } = reportData.reduce((acc, r) => {
        const convertedCost = getConvertedAmount(r.cost, r.currency);
        if (r.type === 'labor') {
            acc.totalLaborCost += convertedCost;
        } else {
            acc.totalNonLaborCost += convertedCost;
        }
        return acc;
    }, { totalLaborCost: 0, totalNonLaborCost: 0 });

    const totalCost = totalLaborCost + totalNonLaborCost;

    // Calculate Dynamic Project Budget based on Billing Model
    const budgetMeta = useMemo(() => {
        if (!project) return { total: 0, type: 'unknown', details: null };

        const model = project.billing_model || 'fixed_price';

        if (model === 'retainer') {
            const amount = Number(project.retainer_amount || 0);
            if (amount === 0) return { total: 0, type: 'retainer', details: null };

            const start = project.contract_start_date ? new Date(project.contract_start_date) : null;
            const end = project.contract_end_date ? new Date(project.contract_end_date) : new Date();

            if (!start) return { total: 0, type: 'retainer', details: null };

            const effectiveEnd = end;
            const period = project.retainer_period || 'month';
            let duration = 0;

            if (period === 'week') {
                duration = Math.max(1, differenceInWeeks(effectiveEnd, start));
            } else if (period === 'quarter') {
                duration = Math.max(1, differenceInMonths(effectiveEnd, start) / 3);
            } else if (period === 'year') {
                duration = Math.max(1, differenceInYears(effectiveEnd, start));
            } else {
                duration = differenceInMonths(effectiveEnd, start) + (effectiveEnd.getDate() > start.getDate() ? 1 : 0);
                if (duration <= 0) duration = 1;
            }

            return {
                total: amount * duration,
                type: 'retainer',
                details: {
                    period: period,
                    amountPerPeriod: amount,
                    duration: duration, // Count
                    startDate: start,
                    endDate: effectiveEnd
                }
            };
        }

        if (model === 'time_and_materials') {
            const hours = Number(project.estimated_duration || 0);
            const rate = Number(project.default_bill_rate_per_hour || 0);
            return {
                total: hours * rate,
                type: 'time_and_materials',
                details: {
                    hours: hours,
                    rate: rate
                }
            };
        }

        return {
            total: Number(project.contract_amount || project.budget || 0),
            type: 'fixed_price',
            details: Number(project.contract_amount || project.budget || 0) > 0 ? { amount: Number(project.contract_amount || project.budget || 0) } : null
        };
    }, [project]);

    const projectBudgetConverted = project ? getConvertedAmount(budgetMeta.total, project.currency) : 0;
    const netProfit = projectBudgetConverted - totalCost;
    const marginPercentage = projectBudgetConverted > 0 ? (netProfit / projectBudgetConverted) * 100 : 0;

    // Calculate Health Score
    const { healthScore, riskLevel } = useMemo(() => {
        if (!project) return { healthScore: 0, riskLevel: 'Unknown' };

        // --- RETAINER HEALTH FORMULA ---
        if (project.billing_model === 'retainer') {
            let score = 0;
            const retainerAmount = budgetMeta.total; // Monthly/Period Amount

            // 1. Revenue Realization (25pts): Is billable utilization matching capacity?
            // Optimal: 80-100% of retainer used. Too low = Client unhappy/Waste. Too high = Risk.
            // Simplified: If Billable Value is 70-100% of Retainer -> Full Points.
            // If < 50%, lose points.
            const billableValue = reportData.reduce((acc, r) => acc + (r.approvedBillable * r.hourlyRate), 0);
            const utilizationRate = retainerAmount > 0 ? (billableValue / retainerAmount) : 0;

            if (utilizationRate >= 0.7 && utilizationRate <= 1.1) score += 25; // Sweet spot
            else if (utilizationRate > 0.4) score += 15;
            else score += 5;

            // 2. Cost Control (25pts): 1 - (Total Cost / Retainer Value)
            // If Cost > Retainer, score drops.
            const costRatio = retainerAmount > 0 ? (totalCost / retainerAmount) : 0;
            if (costRatio <= 0.8) score += 25; // Excellent margin
            else if (costRatio <= 1.0) score += 15; // Safe
            else if (costRatio <= 1.2) score += 5; // Slight Overrun
            else score += 0; // Loss

            // 3. Utilization Balance (25pts): Efficiency (Billable %)
            const totalHours = reportData.reduce((acc, r) => acc + (r.logged || 0), 0);
            const billableHours = reportData.reduce((acc, r) => acc + (r.approvedBillable || 0), 0);
            const efficiency = totalHours > 0 ? (billableHours / totalHours) : 0;

            if (efficiency >= 0.85) score += 25;
            else if (efficiency >= 0.70) score += 15;
            else score += 5;

            // 4. Quality (25pts): Inverse of Rework (Mock or Real if we had rework tag)
            // For now, assume good quality (25) unless we have "Rework" tagged tasks
            // We can check if "Rework" is in any task title
            const hasRework = reportData.some(r => r.task && r.task.toLowerCase().includes('rework'));
            score += hasRework ? 10 : 25;

            // Normalize
            const finalScore = Math.min(100, Math.round(score));

            let derivedRiskLevel = 'Healthy';
            if (finalScore < 40) derivedRiskLevel = 'Critical';
            else if (finalScore < 60) derivedRiskLevel = 'High Risk';
            else if (finalScore < 80) derivedRiskLevel = 'At Risk';

            return { healthScore: finalScore, riskLevel: derivedRiskLevel };
        }

        // --- STANDARD / FIXED PRICE HEALTH FORMULA ---
        let score = 70; // Base score

        // Progress contribution (30 points)
        score += (project.progress || 0) * 0.3;

        // Task completion rate (20 points)
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const taskCompletionRate = tasks.length > 0 ? completedTasks / tasks.length : 0;
        score += taskCompletionRate * 20;

        // Deadline check (deduct up to 20 points if overdue)
        if (project.deadline) {
            const daysUntilDeadline = Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysUntilDeadline < 0) score -= 20; // Overdue
            else if (daysUntilDeadline < 7) score -= 10; // Close to deadline
        }

        // Financial Health Check (Budget Utilization)
        if (projectBudgetConverted > 0) {
            const utilization = totalCost / projectBudgetConverted;
            if (utilization > 1.0) score -= 40;     // Over Budget -> Critical 
            else if (utilization > 0.9) score -= 20; // >90% Used
            else if (utilization > 0.75) score -= 10; // >75% Used
        }

        // Status check
        if (project.status === 'on_hold') score -= 15;
        if (project.status === 'completed') score = 100;

        // Risk level override from field if present
        if (project.risk_level === 'critical') score -= 20;
        else if (project.risk_level === 'high') score -= 15;
        else if (project.risk_level === 'medium') score -= 5;

        // Final Score
        const finalScore = Math.max(0, Math.min(100, Math.round(score)));

        // Determine Risk Level Badge based on Score
        let derivedRiskLevel = 'Healthy';
        if (finalScore < 40) derivedRiskLevel = 'Critical';
        else if (finalScore < 60) derivedRiskLevel = 'High Risk';
        else if (finalScore < 80) derivedRiskLevel = 'At Risk';

        return { healthScore: finalScore, riskLevel: derivedRiskLevel };
    }, [project, tasks, totalCost, projectBudgetConverted, reportData, budgetMeta]);

    // 4. Leakage Insights (Preventive Alerts)
    const leakageInsights = useMemo(() => {
        const insights = [];
        const nonBillableHours = reportData.reduce((acc, r) => acc + (r.nonBillable || 0), 0);

        // Alert 1: Retainer Over-Servicing
        if (project?.billing_model === 'retainer' && budgetMeta.total > 0) {
            if (totalCost > budgetMeta.total) {
                const multiple = (totalCost / budgetMeta.total).toFixed(1);
                insights.push(`Retainer Over-Servicing Alert: Current cost = ${multiple}× retainer value`);
            }
        }

        // Alert 2: Expense Dominance
        if (totalCost > 0) {
            const expenseShare = totalNonLaborCost / totalCost;
            if (expenseShare > 0.8) { // Threshold: 80% (User asked for 88% example, implementing general logic)
                insights.push(`Expense Dominance Alert: Non-labor expenses = ${(expenseShare * 100).toFixed(0)}% of total cost`);
            }
        }

        // Alert 3: Adjustment Detected
        // Check for specific Expense Category or Description called "System Adjustment" or similar
        const adjustment = reportData.find(r => r.type === 'expense' && (
            (r.task && r.task.toLowerCase().includes('adjustment')) ||
            (r.detail && r.detail.toLowerCase().includes('adjustment'))
        ));
        if (adjustment) {
            const adjAmount = formatCurrency(adjustment.cost, targetCurrency);
            insights.push(`Adjustment Detected: ${adjAmount} system adjustment applied`);
        }

        // --- TIME & MATERIALS SPECIFIC ALERTS ---
        if (project?.billing_model === 'time_and_materials') {
            // Check 1: Budget Cap Exceeded (if profit is negative)
            if (netProfit < 0) {
                insights.push("Budget Cap Exceeded: Total costs have surpassed the estimated T&M budget.");
            }

            // Check 2: Low Efficiency (Billable vs Total Labor Hours)
            const totalHours = reportData.reduce((acc, r) => acc + (r.logged || 0), 0);
            const billableHours = reportData.reduce((acc, r) => acc + (r.approvedBillable || 0), 0);
            const efficiency = totalHours > 0 ? (billableHours / totalHours) : 0;

            if (efficiency < 0.70) {
                insights.push(`Low Efficiency: Only ${(efficiency * 100).toFixed(1)}% of logged hours are billable.`);
            }
        }

        // Standard Checks
        if (nonBillableHours > 0 && !insights.some(i => i.includes('efficiency') || i.includes('Efficiency'))) {
            // insights.push(`${nonBillableHours.toFixed(1)} hours are marked as non-billable.`);
        }

        return insights;
    }, [netProfit, totalNonLaborCost, totalLaborCost, totalCost, reportData, project, budgetMeta, targetCurrency]);

    if (loadingProject || loadingTimesheets) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!project) return <div className="p-8">Project not found</div>;



    const clientName = client?.name || project.client || 'N/A';
    const clientContact = clientUser?.full_name || 'N/A';

    return (
        <div className="p-8 space-y-6 bg-slate-50 min-h-screen">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <Button variant="ghost" onClick={() => navigate("/AdminBIDashboard?tab=profitability")} className="mt-1">
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{project.name} - Profitability Detail</h1>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500">
                            <div className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5" />
                                <span className="font-medium">Client:</span> {clientName}
                            </div>
                            <div className="flex items-center gap-1.5 border-l border-slate-300 pl-4">
                                <User className="h-3.5 w-3.5" />
                                <span className="font-medium">Contact:</span> {clientContact}
                            </div>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider ml-2 ${project.status === 'completed' ? 'bg-green-100 text-green-700' :
                                project.status === 'active' ? 'bg-blue-100 text-blue-700' :
                                    'bg-slate-100 text-slate-700'
                                }`}>
                                {project.status || 'Active'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Date & Currency Controls */}
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                    <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-[140px] h-8 text-xs" />
                    <span className="text-slate-400">-</span>
                    <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-[140px] h-8 text-xs" />
                    <Select value={targetCurrency} onValueChange={setTargetCurrency}>
                        <SelectTrigger className="w-[90px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="INR">INR</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>



            {/* Summary Stats */}
            <TooltipProvider>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    <Card>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-1.5 cursor-help">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="border-b border-dotted border-slate-300">
                                            {project.billing_model === 'retainer' ? 'Contract / Retainer Value' : 'Project Budget'}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p>Total value based on {project.billing_model === 'retainer' ? 'monthly retainer fee' : 'fixed budget or estimate'}.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </CardTitle>
                            <Wallet className="h-4 w-4 text-slate-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(projectBudgetConverted, targetCurrency)}</div>

                            <div className="mt-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 uppercase tracking-wide">
                                    {project.billing_model === 'retainer' ? 'Retainer' :
                                        project.billing_model === 'time_and_materials' ? 'Time & Materials' :
                                            'Fixed Price'}
                                </span>
                            </div>

                            {/* Budget Details Footer */}
                            {budgetMeta.details && (
                                <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex flex-col gap-1">
                                    {budgetMeta.type === 'retainer' && (
                                        <>
                                            <div className="flex justify-between">
                                                <span>Period:</span>
                                                <span className="font-medium text-slate-700">
                                                    {format(budgetMeta.details.startDate, 'MMM d, yyyy')} - {format(budgetMeta.details.endDate, 'MMM d, yyyy')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Duration:</span>
                                                <span className="font-medium text-slate-700">{budgetMeta.details.duration} {budgetMeta.details.period}s</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Rate:</span>
                                                <span className="font-medium text-slate-700">{formatCurrency(budgetMeta.details.amountPerPeriod, project.currency)}/{budgetMeta.details.period}</span>
                                            </div>
                                        </>
                                    )}
                                    {/* ... (other types) ... */}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-1.5 cursor-help">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="border-b border-dotted border-slate-300">Labor Cost ({targetCurrency})</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p>Sum of (Approved Billable Hours × Rate) + (Non-Billable Cost).</p>
                                    </TooltipContent>
                                </Tooltip>
                            </CardTitle>
                            <Users className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-700">{formatCurrency(totalLaborCost, targetCurrency)}</div>
                            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex flex-col gap-1">
                                <div className="flex justify-between">
                                    <span>Total Hours:</span>
                                    <span className="font-medium text-slate-700">
                                        {(reportData.reduce((acc, r) => acc + (r.type === 'labor' ? (r.logged || 0) : 0), 0)).toFixed(1)} h
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Billable:</span>
                                    <span className="font-medium text-slate-700">
                                        {(reportData.reduce((acc, r) => acc + (r.type === 'labor' ? (r.approvedBillable || 0) : 0), 0)).toFixed(1)} h
                                    </span>
                                </div>
                                {/* Labor Efficiency Metric */}
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium text-slate-500">Efficiency:</span>
                                        <span className={`font-bold ${(() => {
                                            const total = reportData.reduce((acc, r) => acc + (r.type === 'labor' ? (r.logged || 0) : 0), 0);
                                            const billable = reportData.reduce((acc, r) => acc + (r.type === 'labor' ? (r.approvedBillable || 0) : 0), 0);
                                            const eff = total > 0 ? (billable / total) * 100 : 0;
                                            return eff >= 80 ? 'text-green-600' : eff >= 60 ? 'text-yellow-600' : 'text-red-600';
                                        })()}`}>
                                            {(() => {
                                                const total = reportData.reduce((acc, r) => acc + (r.type === 'labor' ? (r.logged || 0) : 0), 0);
                                                const billable = reportData.reduce((acc, r) => acc + (r.type === 'labor' ? (r.approvedBillable || 0) : 0), 0);
                                                return total > 0 ? `${((billable / total) * 100).toFixed(1)}%` : '0%';
                                            })()}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 text-right">(Billable/Total)</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-1.5 cursor-help">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="border-b border-dotted border-slate-300">Non-Labor Cost ({targetCurrency})</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p>Total of all localized, approved project expenses.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </CardTitle>
                            <Banknote className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        {/* ... (Non Labor Content) ... */}
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-700">{formatCurrency(totalNonLaborCost, targetCurrency)}</div>
                            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex flex-col gap-1">
                                <div className="flex justify-between">
                                    <span>Total Expenses:</span>
                                    <span className="font-medium text-slate-700">
                                        {reportData.filter(r => r.type === 'expense').length}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Avg Expense:</span>
                                    <span className="font-medium text-slate-700">
                                        {(() => {
                                            const count = reportData.filter(r => r.type === 'expense').length;
                                            return count > 0 ? formatCurrency(totalNonLaborCost / count, targetCurrency) : '0';
                                        })()}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-1.5 cursor-help">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="border-b border-dotted border-slate-300">
                                            {netProfit < 0 ? 'Profit Leakage' : 'Profit Margin'}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p>Remaining budget after deducting Labor & Non-Labor costs.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </CardTitle>
                            <TrendingUp className={`h-4 w-4 ${netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <span className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(netProfit, targetCurrency)}
                                </span>
                                <span className={`text-sm font-medium whitespace-nowrap ${marginPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ({marginPercentage.toFixed(1)}%)
                                </span>
                            </div>
                            {/* Leakage Insights Footer */}
                            {netProfit < 0 && leakageInsights.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-red-100 text-xs text-red-600 flex flex-col gap-1.5">
                                    <span className="font-semibold text-red-700 uppercase tracking-wider text-[10px]">Potential Causes:</span>
                                    <ul className="list-disc pl-3 space-y-0.5">
                                        {leakageInsights.map((insight, idx) => (
                                            <li key={idx}>{insight}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-1.5 cursor-help">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="border-b border-dotted border-slate-300">Project Health</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p>Composite score based on Budget, Schedule, and Tasks.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </CardTitle>
                            <Activity className="h-4 w-4 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div>
                                <div className="text-2xl font-bold text-slate-900">{healthScore}%</div>
                                <span className={`text-xs font-medium uppercase px-2 py-0.5 rounded ${riskLevel === 'Healthy' ? 'bg-green-100 text-green-700' :
                                    riskLevel === 'At Risk' ? 'bg-yellow-100 text-yellow-700' :
                                        riskLevel === 'High Risk' ? 'bg-orange-100 text-orange-700' :
                                            'bg-red-100 text-red-700'
                                    }`}>
                                    {riskLevel}
                                </span>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex flex-col gap-1">
                                {project.deadline && new Date(project.deadline) < new Date() && (
                                    <div className="flex justify-between items-center bg-red-50 p-2 rounded text-red-700 mb-2 border border-red-100">
                                        <span className="font-semibold text-xs flex items-center gap-1.5">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            {(() => {
                                                const daysOver = Math.ceil((new Date() - new Date(project.deadline)) / (1000 * 60 * 60 * 24));

                                                // Real Cost Impact Calculation (Daily Burn Rate * Days Over)
                                                const start = project.start_date ? new Date(project.start_date) : new Date(new Date().setDate(new Date().getDate() - 30));
                                                const durationDays = Math.max(1, Math.ceil((new Date() - start) / (1000 * 60 * 60 * 24)));
                                                const dailyBurn = totalCost / durationDays;
                                                const realCostImpact = daysOver * dailyBurn;

                                                if (project.billing_model === 'retainer') {
                                                    return `Timeline deviation detected (${daysOver} ${daysOver === 1 ? 'day' : 'days'}). Impact assessed via cost over-servicing, not schedule.`;
                                                }

                                                return `Project exceeded by ${daysOver} days → ${formatCurrency(realCostImpact, targetCurrency)} cost impact.`;
                                            })()}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span>Tasks:</span>
                                    <span className="font-medium text-slate-700">
                                        {(() => {
                                            const completedTasks = tasks.filter(t => t.status === 'completed').length;
                                            const rate = tasks.length > 0 ? completedTasks / tasks.length : 0;
                                            return `${Math.round(rate * 20)} pts`;
                                        })()}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Budget Impact:</span>
                                    <span className={`font-medium ${projectBudgetConverted > 0 && (totalCost / projectBudgetConverted) > 0.9 ? 'text-red-600' : 'text-slate-700'}`}>
                                        {(() => {
                                            let penalty = 0;
                                            if (projectBudgetConverted > 0) {
                                                const utilization = totalCost / projectBudgetConverted;
                                                if (utilization > 1.0) penalty -= 40;
                                                else if (utilization > 0.9) penalty -= 20;
                                                else if (utilization > 0.75) penalty -= 10;
                                            }
                                            return penalty === 0 ? '-' : `${penalty} pts`;
                                        })()}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TooltipProvider>

            {/* Health Score Thresholds Legend & AI Button */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-6 px-4 py-3 bg-white rounded-lg border border-slate-200 shadow-sm flex-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 mr-2 tracking-wider">Health Status Thresholds:</span>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-xs font-semibold text-slate-700">Healthy</span>
                        <span className="text-[10px] text-slate-400">(≥ 80%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-xs font-semibold text-slate-700">At Risk</span>
                        <span className="text-[10px] text-slate-400">(60-79%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="text-xs font-semibold text-slate-700">High Risk</span>
                        <span className="text-[10px] text-slate-400">(40-59%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-xs font-semibold text-slate-700">Critical</span>
                        <span className="text-[10px] text-slate-400">(&lt; 40%)</span>
                    </div>
                </div>

                <Button
                    onClick={() => setIsAIModalOpen(true)}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25 border-0"
                >
                    <Activity className="h-4 w-4 mr-2" />
                    Insights
                </Button>
            </div>

            <AIInsightsModal
                open={isAIModalOpen}
                onClose={() => setIsAIModalOpen(false)}
                project={project}
                metrics={{
                    totalCost: totalCost,
                    projectBudget: projectBudgetConverted,
                    netProfit: netProfit,
                    currency: targetCurrency,
                    daysOverdue: project.deadline ? Math.ceil((new Date() - new Date(project.deadline)) / (1000 * 60 * 60 * 24)) : 0,
                    costImpact: (() => {
                        // Estimate daily burn rate based on total cost / total duration so far
                        const start = project.start_date ? new Date(project.start_date) : new Date(new Date().setDate(new Date().getDate() - 30));
                        const durationDays = Math.max(1, Math.ceil((new Date() - start) / (1000 * 60 * 60 * 24)));
                        const dailyBurn = totalCost / durationDays;
                        const daysOver = project.deadline ? Math.ceil((new Date() - new Date(project.deadline)) / (1000 * 60 * 60 * 24)) : 0;
                        return daysOver > 0 ? daysOver * dailyBurn : 0;
                    })(),
                    breakdown: {
                        laborCost: totalLaborCost,
                        nonLaborCost: totalNonLaborCost,
                        nonBillableCost: reportData.reduce((acc, r) => {
                            if (r.nonBillable > 0) {
                                return acc + (r.nonBillable * r.hourlyRate); // Estimate cost of non-billable time
                            }
                            return acc;
                        }, 0),
                        // Estimate Estimation Error (e.g. Total Labor - Budget Labor if available, or just keeping it as a factor of labor)
                        // For now we will derive logic in the modal based on these raw values
                    }
                }}

            />

            {/* Main Detail Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Detailed Breakdown</CardTitle>
                    <CardDescription>Comprehensive list of all labor and non-labor costs</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b border-slate-300">
                                <TableHead className="text-center font-bold text-slate-900">Type</TableHead>
                                <TableHead className="text-center font-bold text-slate-900">Sprint</TableHead>
                                <TableHead className="text-center font-bold text-slate-900">Task</TableHead>
                                <TableHead className="text-center font-bold text-slate-900">Employee</TableHead>
                                <TableHead className="text-center font-bold text-slate-900">Logged</TableHead>
                                <TableHead className="text-center font-bold text-slate-900">Approved Billable</TableHead>
                                <TableHead className="text-center font-bold text-slate-900">Non-Billable</TableHead>
                                <TableHead className="text-center font-bold text-slate-900">Hourly Rate</TableHead>
                                <TableHead className="text-center font-bold text-slate-900">Original Cost</TableHead>
                                <TableHead className="text-center font-bold text-slate-900">Converted ({targetCurrency})</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.length === 0 ? (
                                <TableRow><TableCell colSpan={10} className="text-center h-24 text-slate-500">No records found</TableCell></TableRow>
                            ) : (
                                reportData.map((row, i) => (
                                    <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-300 last:border-0">
                                        <TableCell className="text-center">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${row.type === 'labor' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {row.type === 'labor' ? 'Labor' : 'Expense'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-slate-600 text-xs">{row.sprint}</TableCell>
                                        <TableCell className="text-center text-slate-600 text-xs max-w-[200px] truncate" title={row.task}>{row.task}</TableCell>
                                        <TableCell className="text-center font-medium text-slate-700 text-xs">{row.employee}</TableCell>
                                        <TableCell className="text-center text-slate-600 text-xs">{row.logged ? `${row.logged.toFixed(2)} h` : '-'}</TableCell>
                                        <TableCell className="text-center text-slate-600 text-xs">{row.approvedBillable ? `${row.approvedBillable.toFixed(2)} h` : '-'}</TableCell>
                                        <TableCell className="text-center text-slate-400 text-xs">{row.nonBillable ? `${row.nonBillable.toFixed(2)} h` : '-'}</TableCell>
                                        <TableCell className="text-center text-slate-600 text-xs">
                                            {row.type === 'labor' && row.hourlyRate ? (
                                                <div className="flex flex-row items-center justify-center gap-2">
                                                    <span>{formatCurrency(row.hourlyRate, row.currency)}/hr</span>
                                                    {row.originalRate > 0 && row.userCurrency !== row.currency && (
                                                        <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] border border-slate-200 whitespace-nowrap">
                                                            {formatCurrency(row.originalRate, row.userCurrency)}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="text-center font-medium text-slate-700 text-xs">
                                            {formatCurrency(row.originalAmount !== undefined ? row.originalAmount : row.cost, row.originalCurrency || row.currency)}
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-blue-600 text-xs">
                                            {formatCurrency(getConvertedAmount(row.cost, row.currency), targetCurrency)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Task Detail Dialog */}
            {
                selectedTaskId && (
                    <TaskDetailDialog
                        open={isTaskDetailOpen}
                        onClose={() => setIsTaskDetailOpen(false)}
                        taskId={selectedTaskId}
                        readOnly={true}
                    />
                )
            }
        </div>
    );
}

