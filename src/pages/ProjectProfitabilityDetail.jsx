import React, { useState, useMemo, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { ArrowLeft, Loader2, Download, Filter, Wallet, Users, Banknote, TrendingUp, TrendingDown, Building2, User, Activity, AlertCircle, Flag, Zap, BarChart3, Clock3, CheckCircle2, Lock } from "lucide-react";
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

    const [targetCurrency, setTargetCurrency] = useState("INR");
    const [conversionRates, setConversionRates] = useState({});
    const [isLoadingRates, setIsLoadingRates] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [selectedMilestone, setSelectedMilestone] = useState("all");

    const { user: currentUser } = useUser();
    const queryClient = useQueryClient();

    // Update Milestone Mutation
    const updateMilestoneMutation = useMutation({
        mutationFn: ({ id, data }) => groonabackend.entities.Milestone.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["milestones", projectId] });
            // Notification is handled by the caller or global setup if any
        },
        onError: (err) => console.error("Failed to update milestone:", err),
    });

    const handleMarkMilestoneComplete = (milestoneId) => {
        if (!milestoneId) return;
        updateMilestoneMutation.mutate({
            id: milestoneId,
            data: { status: 'completed', progress: 100 }
        });
    };

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
            const filtered = all.filter(t => {
                const tPid = typeof t.project_id === 'object' ? t.project_id.id : t.project_id;
                return tPid === projectId;
            });
            console.log(`[DEBUG] Timesheets fetched for project ${projectId}:`, filtered.length, filtered);
            return filtered;
        },
        enabled: !!projectId,
    });

    const { data: expenses = [] } = useQuery({
        queryKey: ["project-expenses", projectId],
        queryFn: async () => {
            const all = await groonabackend.entities.ProjectExpense.list();
            const filtered = all.filter(e => {
                const ep = e.project_id || e.project || e.projectId;
                const ePid = typeof ep === 'object' ? (ep.id || ep._id) : ep;
                return String(ePid) === String(projectId);
            });
            console.log(`[DEBUG] Expenses fetched (raw) for project ${projectId}:`, filtered.length, filtered);
            return filtered;
        },
        enabled: !!projectId,
    });

    // Fetch Users to get Hourly Rates
    const { data: users = [] } = useQuery({
        queryKey: ["users"],
        queryFn: () => groonabackend.entities.User.list(),
    });

    // Fetch Tasks & Milestones for granular breakdown
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

    const { data: milestones = [], isLoading: loadingMilestones } = useQuery({
        queryKey: ["milestones", projectId],
        queryFn: async () => {
            const all = await groonabackend.entities.Milestone.list();
            return all.filter(m => {
                const mPid = typeof m.project_id === 'object' ? m.project_id.id : m.project_id;
                return mPid === projectId;
            });
        },
        enabled: !!projectId,
    });

    // Fetch Exchange Rates
    useEffect(() => {
        const fetchRates = async () => {
            if (!project) return;
            // Identify currencies involved: Project Currency, User Currencies, Expense Currencies
            const currencies = new Set();
            if (project.currency) currencies.add(project.currency);
            users.forEach(u => { if (u.ctc_currency) currencies.add(u.ctc_currency); }); // User preferred currency
            expenses.forEach(e => {
                const eCurr = e.currency || project.currency || 'INR';
                currencies.add(eCurr);
            });

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
            const rate = conversionRates[`${c}_${targetCurrency}`];
            return (rate !== undefined && rate !== null) ? rate : 0;
        };

        const rateFrom = getRateToTarget(from);
        const rateTo = getRateToTarget(to);

        if (rateFrom > 0 && rateTo > 0) {
            return rateFrom / rateTo;
        }

        // Defensive log
        if (from !== to) {
            // console.log(`[DEBUG] Rate fallback (1) for ${from}->${to}. Rates: ${rateFrom}, ${rateTo}`);
        }
        return 1; // Fallback if rates missing or 0
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

    // --- DATA PROCESSING ---
    const allReportData = useMemo(() => {
        if (!timesheets.length && !expenses.length) return [];
        const rows = [];

        // 1. Labor Costs (Timesheets)
        const laborMap = {};

        timesheets.forEach(t => {
            const tDate = t.date?.$date ? t.date.$date : t.date;
            const dateStr = format(new Date(tDate), 'yyyy-MM-dd');
            const mId = t.milestone_id || (tasks.find(tsk => tsk.id === t.task_id)?.milestone_id) || 'unassigned';

            // No filtering here - calculation for all data
            const key = `${t.user_email}_${mId}_${t.task_id}`;
            if (!laborMap[key]) {
                const user = users.find(u => u.email === t.user_email);
                const task = tasks.find(tsk => tsk.id === t.task_id);
                const milestone = milestones.find(m => (m.id || m._id) === mId);
                laborMap[key] = {
                    type: 'labor',
                    milestoneName: milestone ? milestone.name : 'Unassigned/General',
                    milestoneId: milestone ? (milestone.id || milestone._id) : null,
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
                    loggedCostAcc: 0, // All logged hours cost
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
                const snapTotal = Number(t.snapshot_total_cost);
                if (t.snapshot_total_cost !== undefined && t.snapshot_total_cost !== null && snapTotal > 0) {
                    row.originalCostAcc += snapTotal;
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

            // Always track logged cost for leakage
            row.loggedCostAcc += ((t.total_minutes || 0) / 60) * effectiveRateProjectCurrency;
        });

        // 2. Non-Labor Costs (Expenses)
        const finalExpenseRows = expenses.filter(e => {
            // Include Approved or Pending for internal visibility? User said "all add and show"
            const mId = e.milestone_id || e.milestone || 'unassigned';
            const normalizedMId = typeof mId === 'object' ? (mId.id || mId._id) : mId;

            // No filtering here - calculation for all data
            return true;
        }).map(e => {
            const projectCurrency = project?.currency || 'INR';
            const eCurr = e.currency || projectCurrency;
            const convRate = getRate(eCurr, projectCurrency);
            const costInProject = Number(e.amount || 0) * convRate;

            const mId = e.milestone_id || e.milestone || 'unassigned';
            const normalizedMId = typeof mId === 'object' ? (mId.id || mId._id) : mId;
            const milestone = milestones.find(m => String(m.id || m._id) === String(normalizedMId));

            return {
                type: 'expense',
                sprint: milestone ? milestone.name : '-',
                milestoneId: milestone ? (milestone.id || milestone._id) : null,
                task: e.description || e.category,
                employee: e.vendor || 'Expense',
                logged: 0,
                approvedBillable: 0,
                nonBillable: 0,
                hourlyRate: 0,
                cost: costInProject,
                currency: projectCurrency,
                originalAmount: e.amount,
                originalCurrency: e.currency || projectCurrency
            };
        });

        // Combine all rows
        const finalLaborRowsArr = Object.values(laborMap).map(r => {
            const projectCurrency = project?.currency || 'INR';
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
                sprint: r.milestoneName, // Display milestone in the "Sprint/Phase" column
                milestoneId: r.milestoneId,
                task: r.taskTitle,
                employee: r.employeeName,
                logged: r.loggedHours,
                approvedBillable: r.approvedHours,
                nonBillable: r.nonBillableHours,
                originalAmount: r.originalCostAcc,
                originalCurrency: r.userCurrency
            };
        });

        const combined = [...finalLaborRowsArr, ...finalExpenseRows];
        console.log(`[DEBUG] All Report Rows:`, {
            totalRows: combined.length,
            laborRows: finalLaborRowsArr.length,
            expenseRows: finalExpenseRows.length
        });

        return combined.sort((a, b) => {
            const dateA = a.lastDate || '0000-00-00';
            const dateB = b.lastDate || '0000-00-00';
            return dateB.localeCompare(dateA);
        });
    }, [timesheets, expenses, users, tasks, milestones, project, conversionRates]);

    // Filtered data for the main table display
    const filteredReportData = useMemo(() => {
        if (selectedMilestone === 'all') return allReportData;
        return allReportData.filter(r => r.milestoneId === selectedMilestone || (r.milestoneId && String(r.milestoneId) === String(selectedMilestone)));
    }, [allReportData, selectedMilestone]);

    // Global P&L accumulation across all milestones (The "Table of Truth")
    const mlist = useMemo(() => {
        if (!milestones.length || !project) return [];

        return milestones.map(m => {
            const mId = m.id || m._id;
            const mData = allReportData.filter(r => (r.milestoneId || r.task_milestone_id) === mId);

            const contractAmount = getConvertedAmount(m.budget_value || 0, project.currency);
            const expBudget = getConvertedAmount(m.expense_budget || 0, project.currency);

            const laborCost = mData.filter(r => r.type === 'labor').reduce((acc, r) => acc + getConvertedAmount(r.cost, r.currency), 0);
            const expenseCost = mData.filter(r => r.type === 'expense').reduce((acc, r) => acc + getConvertedAmount(r.cost, r.currency), 0);
            const totalPhaseCost = laborCost + expenseCost;
            const phaseProfit = contractAmount - totalPhaseCost;

            // --- HEALTH SCORE: Utilization-based grading ---
            // 0-70% = Healthy, 70-80% = watch, 80-90% = At Risk, 90-100% = High Risk, >100% = Critical
            let healthScore = 100;
            let healthStatus = 'Healthy';
            let healthReason = 'Cost is within healthy parameters of the contract value.';

            if (contractAmount <= 0 && totalPhaseCost > 0) {
                healthScore = 0;
                healthStatus = 'Critical';
                healthReason = 'No contract value is defined, but costs have been incurred for this phase.';
            } else if (contractAmount > 0) {
                const utilization = (totalPhaseCost / contractAmount) * 100;

                if (utilization > 100) {
                    const overBy = utilization - 100;
                    healthScore = Math.max(0, Math.round(39 - overBy));
                    healthStatus = healthScore < 20 ? 'Critical' : 'High Risk';
                    healthReason = `Cost overrun: This phase has used ${utilization.toFixed(0)}% of its contract value (${overBy.toFixed(0)}% over budget).`;
                } else if (utilization >= 90) {
                    healthScore = Math.round(40 + (100 - utilization) * 1.5);
                    healthStatus = 'High Risk';
                    healthReason = `High budget utilization at ${utilization.toFixed(0)}%. Very little buffer remains before overrun.`;
                } else if (utilization >= 80) {
                    healthScore = Math.round(60 + (90 - utilization) * 1.5);
                    healthStatus = 'At Risk';
                    healthReason = `Moderately high costs at ${utilization.toFixed(0)}% of contract value. Monitor closely to avoid overrun.`;
                } else if (utilization >= 70) {
                    healthScore = Math.round(80 + (80 - utilization));
                    healthStatus = 'Healthy';
                    healthReason = `On track: ${utilization.toFixed(0)}% of contract value used, within acceptable range.`;
                } else {
                    healthScore = 100;
                    healthStatus = 'Healthy';
                    healthReason = `Strong margin: Only ${utilization.toFixed(0)}% of this phase's contract value has been used.`;
                }

                healthScore = Math.max(0, Math.min(100, healthScore));
            }

            return {
                phaseName: m.name,
                milestoneId: mId,
                status: m.status,
                contractAmount,
                expBudget,
                laborCost,
                expenseCost,
                totalPhaseCost,
                phaseProfit,
                healthScore,
                healthStatus,
                healthReason,
                profitPoint: phaseProfit
            };
        });
    }, [milestones, allReportData, project, targetCurrency, conversionRates]);

    // Calculate Totals by Type from Report Data
    console.log(`[DEBUG] Starting Totals Calculation for ${filteredReportData.length} rows...`);
    const { totalLaborCost, totalNonLaborCost, totalLoggedLaborCost } = filteredReportData.reduce((acc, r, idx) => {
        const convertedCost = Number(getConvertedAmount(r.cost, r.currency)) || 0;

        if (idx < 5 || r.type === 'expense') {
            console.log(`[DEBUG] Row ${idx}: type=${r.type}, cost=${r.cost}, currency=${r.currency}, converted=${convertedCost}`);
        }

        if (r.type === 'labor') {
            acc.totalLaborCost += convertedCost;
            acc.totalLoggedLaborCost += (Number(getConvertedAmount(r.loggedCostAcc, r.currency)) || 0);
        } else if (r.type === 'expense') {
            acc.totalNonLaborCost += convertedCost;
        }
        return acc;
    }, { totalLaborCost: 0, totalNonLaborCost: 0, totalLoggedLaborCost: 0 });

    console.log(`[DEBUG] Final Financial Totals (INR):`, {
        totalLaborCost,
        totalNonLaborCost,
        totalLoggedLaborCost,
        totalCost: totalLaborCost + totalNonLaborCost
    });

    const totalCost = totalLaborCost + totalNonLaborCost;

    // Expense Budget (milestone-aware)
    const expenseBudgetValue = useMemo(() => {
        if (selectedMilestone !== "all") {
            const milestone = milestones.find(m => (m.id || m._id) === selectedMilestone);
            if (milestone) {
                const rawMilestoneExpBudget = Number(milestone.expense_budget || 0);
                // For T&M, multiply by milestone's estimated duration (hours)
                return (milestone.billing_model === 'time_and_materials' || project?.billing_model === 'time_and_materials')
                    ? rawMilestoneExpBudget * Number(milestone.estimated_duration || 0)
                    : rawMilestoneExpBudget;
            }
        }
        const rawExpenseBudget = Number(project?.expense_budget || 0);
        return project?.billing_model === 'time_and_materials'
            ? rawExpenseBudget * Number(project?.estimated_duration || 0)
            : rawExpenseBudget;
    }, [project, selectedMilestone, milestones]);
    const budgetUsedPercent = expenseBudgetValue > 0 ? (totalCost / expenseBudgetValue) * 100 : null;
    const expenseRemaining = expenseBudgetValue > 0 ? expenseBudgetValue - totalCost : null;

    // Profit Leakage Calculation (Milestone-Aware)
    const laborLeakage = Math.max(0, totalLoggedLaborCost - totalLaborCost);
    let projectLeakage = 0;
    const model = project?.billing_model || 'fixed_price';

    // Use milestone budget when a specific milestone is selected
    const contractBudget = (() => {
        if (selectedMilestone !== "all") {
            const milestone = milestones.find(m => (m.id || m._id) === selectedMilestone);
            if (milestone) return Number(milestone.budget_value || 0);
        }
        return Number(project?.contract_amount || project?.budget || 0);
    })();
    const billingModelBudget = (selectedMilestone !== "all")
        ? contractBudget // Single milestone: use its budget_value directly
        : (model === 'retainer' ? (Number(project?.retainer_amount || 0) || contractBudget) : contractBudget);

    switch (model) {
        case 'fixed_price':
            projectLeakage = Math.max(0, totalCost - billingModelBudget) + laborLeakage;
            break;
        case 'retainer':
            projectLeakage = Math.max(0, totalCost - billingModelBudget);
            break;
        case 'time_and_materials':
            projectLeakage = laborLeakage;
            break;
        case 'non_billable':
            projectLeakage = totalCost;
            break;
        default:
            projectLeakage = laborLeakage;
    }
    const leakagePercent = billingModelBudget > 0 ? (projectLeakage / billingModelBudget) * 100 : 0;

    // Calculate Dynamic Project Budget based on Billing Model
    const budgetMeta = useMemo(() => {
        if (!project) return { total: 0, type: 'unknown', details: null };

        // If a specific milestone is selected, use the milestone's budget value (Contract Amount)
        if (selectedMilestone !== "all") {
            const milestone = milestones.find(m => (m.id || m._id) === selectedMilestone);
            if (milestone) {
                return {
                    total: Number(milestone.budget_value || 0),
                    type: 'fixed_price', // Treat single milestone as fixed for the summary card
                    details: { amount: Number(milestone.budget_value || 0), milestoneName: milestone.name }
                };
            }
        }

        const model = project.billing_model || 'fixed_price';

        if (model === 'retainer') {
            const amount = Number(project.retainer_amount || project.contract_amount || project.budget || 0);
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
    }, [project, milestones, selectedMilestone]);

    const projectBudgetConverted = project ? getConvertedAmount(budgetMeta.total, project.currency) : 0;
    const netProfit = projectBudgetConverted - totalCost;
    const marginPercentage = projectBudgetConverted > 0 ? (netProfit / projectBudgetConverted) * 100 : 0;

    // Overall Project Metrics (FOR AI ANALYSIS)
    const overallProjectBudget = useMemo(() => {
        if (!project) return 0;
        const model = project.billing_model || 'fixed_price';
        if (model === 'retainer' || model === 'time_and_materials') {
            // Re-calculate but specifically for its own overall case if needed, 
            // but for simple cases just use a simplified version of budgetMeta logic for 'all'
            const amount = Number(project.contract_amount || project.budget || 0);
            return getConvertedAmount(amount, project.currency);
        }
        return getConvertedAmount(Number(project.contract_amount || project.budget || 0), project.currency);
    }, [project]);

    const overallTotalCost = useMemo(() => {
        return allReportData.reduce((acc, r) => acc + getConvertedAmount(r.cost, r.currency), 0);
    }, [allReportData, project, conversionRates]);

    const overallNetProfit = overallProjectBudget - overallTotalCost;

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
            const billableValue = allReportData.reduce((acc, r) => acc + (r.approvedBillable * r.hourlyRate), 0);
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
            const totalHours = allReportData.reduce((acc, r) => acc + (r.logged || 0), 0);
            const billableHours = allReportData.reduce((acc, r) => acc + (r.approvedBillable || 0), 0);
            const efficiency = totalHours > 0 ? (billableHours / totalHours) : 0;

            if (efficiency >= 0.85) score += 25;
            else if (efficiency >= 0.70) score += 15;
            else score += 5;

            // 4. Quality (25pts): Inverse of Rework (Mock or Real if we had rework tag)
            // For now, assume good quality (25) unless we have "Rework" tagged tasks
            // We can check if "Rework" is in any task title
            const hasRework = allReportData.some(r => r.task && r.task.toLowerCase().includes('rework'));
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

        // Milestone-aware task filtering
        const filteredTasks = selectedMilestone !== "all"
            ? tasks.filter(t => t.milestone_id === selectedMilestone)
            : tasks;

        // Progress contribution (30 points)
        // Use milestone progress if milestone is selected
        const progressValue = (() => {
            if (selectedMilestone !== "all") {
                const milestone = milestones.find(m => (m.id || m._id) === selectedMilestone);
                if (milestone) {
                    const mTasks = tasks.filter(t => t.milestone_id === selectedMilestone);
                    const completed = mTasks.filter(t => t.status === 'completed' || t.status === 'done').length;
                    return mTasks.length > 0 ? Math.round((completed / mTasks.length) * 100) : 0;
                }
            }
            return project.progress || 0;
        })();
        score += progressValue * 0.3;

        // Task completion rate (20 points) — milestone-filtered
        const completedTasks = filteredTasks.filter(t => t.status === 'completed' || t.status === 'done').length;
        const taskCompletionRate = filteredTasks.length > 0 ? completedTasks / filteredTasks.length : 0;
        score += taskCompletionRate * 20;

        // Deadline check (use milestone due_date if filtered, else project deadline)
        const deadlineDate = (() => {
            if (selectedMilestone !== "all") {
                const milestone = milestones.find(m => (m.id || m._id) === selectedMilestone);
                return milestone?.due_date || project.deadline;
            }
            return project.deadline;
        })();
        if (deadlineDate) {
            const daysUntilDeadline = Math.ceil((new Date(deadlineDate) - new Date()) / (1000 * 60 * 60 * 24));
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
    }, [project, tasks, totalCost, projectBudgetConverted, allReportData, budgetMeta, selectedMilestone, milestones]);

    // 4. Milestone Performance Analysis (NEW)
    const milestonePerformance = useMemo(() => {
        const targetMilestones = selectedMilestone === "all"
            ? milestones
            : milestones.filter(m => (m.id || m._id) === selectedMilestone);

        return targetMilestones.map(m => {
            const mId = m.id || m._id;
            // Filter report data for this milestone
            const mData = allReportData.filter(r => (r.milestoneId || r.task_milestone_id) === mId);

            const actualCost = mData.reduce((acc, r) => acc + getConvertedAmount(r.cost, r.currency), 0);
            const budget = getConvertedAmount(m.budget_value || 0, project?.currency || targetCurrency);

            // Automated Metrics
            const mTasks = tasks.filter(t => t.milestone_id === mId);
            const completed = mTasks.filter(t => t.status === 'completed' || t.status === 'done').length;
            const progress = mTasks.length > 0 ? Math.round((completed / mTasks.length) * 100) : 0;

            let status = m.status || 'pending';
            if (status !== 'completed' && m.due_date && new Date(m.due_date) < new Date()) status = 'missed';

            // Earned Value = (Progress % / 100) * Milestone Budget
            const earnedValue = (progress / 100) * budget;

            // Expense Variance
            const expBudget = getConvertedAmount(m.expense_budget || 0, project?.currency || targetCurrency);
            const actualExpense = mData.filter(r => r.type === 'expense').reduce((acc, r) => acc + getConvertedAmount(r.cost, r.currency), 0);
            const expVariance = expBudget > 0 ? (actualExpense / expBudget) : 0;

            // Variance
            const variance = earnedValue - actualCost;

            return {
                ...m,
                progress,
                status,
                actualCost,
                budget,
                earnedValue,
                burnRate: expVariance, // Use expense variance as burn rate for now
                variance,
            };
        });
    }, [milestones, allReportData, project, tasks, targetCurrency]);

    // 5. Leakage Insights (Preventive Alerts)
    const leakageInsights = useMemo(() => {
        const insights = [];
        const nonBillableHours = allReportData.reduce((acc, r) => acc + (r.nonBillable || 0), 0);

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
        const adjustment = allReportData.find(r => r.type === 'expense' && (
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
            const totalHours = allReportData.reduce((acc, r) => acc + (r.logged || 0), 0);
            const billableHours = allReportData.reduce((acc, r) => acc + (r.approvedBillable || 0), 0);
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
    }, [netProfit, totalNonLaborCost, totalLaborCost, totalCost, allReportData, project, budgetMeta, targetCurrency]);

    if (loadingProject || loadingTimesheets) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!project) return <div className="p-8">Project not found</div>;



    const clientName = client?.name || project.client || 'N/A';
    const clientContact = clientUser?.full_name || 'N/A';

    return (
        <TooltipProvider>
            <div className="p-3 sm:p-5 lg:p-8 space-y-4 lg:space-y-6 bg-slate-50 min-h-screen">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <Button variant="ghost" onClick={() => navigate("/AdminBIDashboard?tab=profitability")} className="mt-1 w-fit">
                            <ArrowLeft className="h-4 w-4 mr-2" /> Back
                        </Button>
                        <div>
                            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 leading-tight">{project.name} — Profitability Detail</h1>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-sm text-slate-500">
                                <div className="flex items-center gap-1.5">
                                    <Building2 className="h-3.5 w-3.5" />
                                    <span className="font-medium">Client:</span> {clientName}
                                </div>
                                <div className="flex items-center gap-1.5 sm:border-l sm:border-slate-300 sm:pl-4">
                                    <User className="h-3.5 w-3.5" />
                                    <span className="font-medium">Contact:</span> {clientContact}
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider ${project.status === 'completed' ? 'bg-green-100 text-green-700' :
                                    project.status === 'active' ? 'bg-blue-100 text-blue-700' :
                                        'bg-slate-100 text-slate-700'
                                    }`}>
                                    {project.status || 'Active'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Date, Milestone & Currency Controls */}
                    <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">

                        <Select value={selectedMilestone} onValueChange={setSelectedMilestone}>
                            <SelectTrigger className="w-[140px] sm:w-[160px] h-8 text-xs"><SelectValue placeholder="All Milestones" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Milestones</SelectItem>
                                {milestones.map(m => (
                                    <SelectItem key={m.id || m._id} value={m.id || m._id}>
                                        {m.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={targetCurrency} onValueChange={setTargetCurrency}>
                            <SelectTrigger className="w-[80px] sm:w-[90px] h-8 text-xs"><SelectValue /></SelectTrigger>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 lg:gap-4">

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
                                            {(filteredReportData.reduce((acc, r) => acc + (r.type === 'labor' ? (r.logged || 0) : 0), 0)).toFixed(1)} h
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Billable:</span>
                                        <span className="font-medium text-slate-700">
                                            {(filteredReportData.reduce((acc, r) => acc + (r.type === 'labor' ? (r.approvedBillable || 0) : 0), 0)).toFixed(1)} h
                                        </span>
                                    </div>
                                    {/* Labor Efficiency Metric */}
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-slate-500">Efficiency:</span>
                                            <span className={`font-bold ${(() => {
                                                const total = filteredReportData.reduce((acc, r) => acc + (r.type === 'labor' ? (r.logged || 0) : 0), 0);
                                                const billable = filteredReportData.reduce((acc, r) => acc + (r.type === 'labor' ? (r.approvedBillable || 0) : 0), 0);
                                                const eff = total > 0 ? (billable / total) * 100 : 0;
                                                return eff >= 80 ? 'text-green-600' : eff >= 60 ? 'text-yellow-600' : 'text-red-600';
                                            })()}`}>
                                                {(() => {
                                                    const total = filteredReportData.reduce((acc, r) => acc + (r.type === 'labor' ? (r.logged || 0) : 0), 0);
                                                    const billable = filteredReportData.reduce((acc, r) => acc + (r.type === 'labor' ? (r.approvedBillable || 0) : 0), 0);
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
                                            {filteredReportData.filter(r => r.type === 'expense').length}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Avg Expense:</span>
                                        <span className="font-medium text-slate-700">
                                            {(() => {
                                                const count = filteredReportData.filter(r => r.type === 'expense').length;
                                                return count > 0 ? formatCurrency(totalNonLaborCost / count, targetCurrency) : '0';
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Expense Budget Card */}
                        <Card>
                            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="border-b border-dotted border-slate-300">Expense Budget</span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p>{selectedMilestone !== 'all' ? 'Expense budget for the selected milestone.' : `Project expense budget${project?.billing_model === 'time_and_materials' ? ' × estimated duration (T&M)' : ''}.`}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </CardTitle>
                                <Banknote className="h-4 w-4 text-blue-400" />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${expenseBudgetValue > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                    {expenseBudgetValue > 0 ? formatCurrency(expenseBudgetValue, project?.currency || targetCurrency) : '—'}
                                </div>
                                {expenseBudgetValue > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex flex-col gap-1">
                                        <div className="flex justify-between">
                                            <span>Remaining:</span>
                                            <span className={`font-medium ${expenseRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {formatCurrency(expenseRemaining, project?.currency || targetCurrency)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Budget Used % Card */}
                        <Card>
                            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="border-b border-dotted border-slate-300">Budget Used %</span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p>(Labor + Non-Labor Cost) ÷ Expense Budget × 100</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </CardTitle>
                                <AlertCircle className="h-4 w-4 text-blue-400" />
                            </CardHeader>
                            <CardContent>
                                {budgetUsedPercent != null ? (
                                    <>
                                        <div className={`text-2xl font-bold ${budgetUsedPercent > 100 ? 'text-red-600' :
                                            budgetUsedPercent > 80 ? 'text-amber-600' :
                                                'text-green-600'
                                            }`}>
                                            {budgetUsedPercent.toFixed(1)}%
                                        </div>
                                        <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5">
                                            <div
                                                className={`h-1.5 rounded-full ${budgetUsedPercent > 100 ? 'bg-red-500' :
                                                    budgetUsedPercent > 80 ? 'bg-amber-500' :
                                                        'bg-green-500'
                                                    }`}
                                                style={{ width: `${Math.min(100, budgetUsedPercent)}%` }}
                                            />
                                        </div>
                                        <div className="mt-2 text-xs text-slate-500">
                                            {formatCurrency(totalCost, targetCurrency)} of {formatCurrency(expenseBudgetValue, project?.currency || targetCurrency)}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-2xl font-bold text-slate-400">—</div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-1.5 cursor-help text-red-600">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="border-b border-dotted border-red-300">Profit Leakage</span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p>Unbillable hours, bench cost, or budget overruns.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </CardTitle>
                                <TrendingDown className="h-4 w-4 text-red-500" />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${projectLeakage > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                    {formatCurrency(projectLeakage, project?.currency || targetCurrency)}
                                </div>
                                {projectLeakage > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                                        {leakagePercent.toFixed(1)}% of Budget Impact
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-1.5 cursor-help">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="border-b border-dotted border-slate-300">
                                                Profit / (Loss)
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

                    {/* Performance Insights */}
                    <Card className="border-slate-200">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <Zap className="h-5 w-5 text-amber-500" />
                                    Performance Insights
                                    {selectedMilestone !== 'all' && (
                                        <Badge variant="outline" className="text-xs ml-2">
                                            {milestones.find(m => (m.id || m._id) === selectedMilestone)?.name || 'Milestone'}
                                        </Badge>
                                    )}
                                </CardTitle>

                                {/* Mark Complete Action */}
                                {(() => {
                                    if (selectedMilestone === 'all') return null;
                                    const milestone = milestones.find(m => (m.id || m._id) === selectedMilestone);
                                    if (!milestone || milestone.status === 'completed') return null;

                                    return (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 gap-1.5 font-bold"
                                            onClick={() => handleMarkMilestoneComplete(selectedMilestone)}
                                            disabled={updateMilestoneMutation.isPending}
                                        >
                                            {updateMilestoneMutation.isPending ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                            )}
                                            Mark Phase as Complete
                                        </Button>
                                    );
                                })()}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                {/* Cost Breakdown */}
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Cost Breakdown</div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600">Labor Cost</span>
                                            <span className="font-bold text-blue-700">{formatCurrency(totalLaborCost, targetCurrency)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600">Non-Labor Cost</span>
                                            <span className="font-bold text-orange-700">{formatCurrency(totalNonLaborCost, targetCurrency)}</span>
                                        </div>
                                        <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                                            <span className="font-medium text-slate-700">Total Cost</span>
                                            <span className="font-bold text-slate-900">{formatCurrency(totalCost, targetCurrency)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Budget vs Actual */}
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Budget vs Actual</div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600">Contract Budget</span>
                                            <span className="font-bold text-emerald-700">{formatCurrency(projectBudgetConverted, targetCurrency)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600">Cost to Date</span>
                                            <span className="font-bold text-slate-900">{formatCurrency(totalCost, targetCurrency)}</span>
                                        </div>
                                        <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                                            <span className="font-medium text-slate-700">Remaining</span>
                                            <span className={`font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {formatCurrency(netProfit, targetCurrency)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Expense Budget Tracking */}
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Expense Budget</div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600">Budget</span>
                                            <span className="font-bold text-blue-600">
                                                {expenseBudgetValue > 0 ? formatCurrency(expenseBudgetValue, project?.currency || targetCurrency) : '—'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600">Actual Expenses</span>
                                            <span className="font-bold text-orange-700">{formatCurrency(totalNonLaborCost, targetCurrency)}</span>
                                        </div>
                                        {expenseBudgetValue > 0 && (
                                            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                                                <span className="font-medium text-slate-700">Usage</span>
                                                <Badge className={`${(totalNonLaborCost / expenseBudgetValue) > 1 ? 'bg-red-100 text-red-700' : (totalNonLaborCost / expenseBudgetValue) > 0.8 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                                    {((totalNonLaborCost / expenseBudgetValue) * 100).toFixed(1)}%
                                                </Badge>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Efficiency Metrics */}
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Efficiency</div>
                                    <div className="space-y-2">
                                        {(() => {
                                            const totalHours = allReportData.reduce((acc, r) => acc + (r.type === 'labor' ? (r.logged || 0) : 0), 0);
                                            const billableHours = allReportData.reduce((acc, r) => acc + (r.type === 'labor' ? (r.approvedBillable || 0) : 0), 0);
                                            const efficiency = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
                                            const margin = projectBudgetConverted > 0 ? (netProfit / projectBudgetConverted) * 100 : 0;
                                            return (
                                                <>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-slate-600">Billable Efficiency</span>
                                                        <Badge className={`${efficiency >= 80 ? 'bg-green-100 text-green-700' : efficiency >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                                            {efficiency.toFixed(1)}%
                                                        </Badge>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-slate-600">Profit Margin</span>
                                                        <Badge className={`${margin >= 20 ? 'bg-green-100 text-green-700' : margin >= 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                                            {margin.toFixed(1)}%
                                                        </Badge>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-slate-600">Hours Logged</span>
                                                        <span className="font-bold text-slate-700">{totalHours.toFixed(1)} h</span>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Leakage Alerts */}
                            {leakageInsights.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    {leakageInsights.map((insight, idx) => (
                                        <div key={idx} className="p-3 bg-red-50 border border-red-100 rounded-lg flex gap-3">
                                            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                            <div className="text-xs text-red-700 font-medium">{insight}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </TooltipProvider>

                {/* Project Completion or Milestone Completion — Profit & Loss Statement */}
                {(() => {
                    const isProjectCompleted = project.status === 'completed';
                    const selectedM = selectedMilestone !== 'all' ? milestones.find(m => (m.id || m._id) === selectedMilestone) : null;
                    const isMilestoneSettled = selectedM && selectedM.status === 'completed';

                    const billingModel = project.billing_model || 'fixed_price';
                    const isNoMilestoneModel = (billingModel === 'time_and_materials' || billingModel === 'retainer') && milestones.length === 0;

                    // Show if we have milestones OR unallocated data OR it's a T&M/Retainer model
                    const unallocatedData = allReportData.filter(r => !r.milestoneId && !r.task_milestone_id);
                    if (!isNoMilestoneModel && milestones.length === 0 && unallocatedData.length === 0) return null;

                    const displayMilestones = selectedMilestone !== 'all'
                        ? milestones.filter(m => (m.id || m._id) === selectedMilestone)
                        : milestones;

                    const cardTitle = isProjectCompleted
                        ? 'Project Completion — P&L Statement'
                        : isMilestoneSettled
                            ? `${selectedM?.name} — P&L Statement`
                            : (selectedMilestone === 'all' ? 'Live Project — Real-time P&L Statement' : `${selectedM?.name} — Phase Performance Detail`);

                    const cardDescription = isProjectCompleted
                        ? 'Phase-wise accumulation of revenue, costs, and profit for the completed project'
                        : isMilestoneSettled
                            ? `Financial performance summary for the settled milestone: ${selectedM?.name}`
                            : 'Real-time financial tracking including live costs and projected profit points';

                    return (
                        <Card className={`border-2 shadow-lg ${isProjectCompleted ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white' : 'border-blue-200 bg-gradient-to-br from-blue-50/50 to-white'}`}>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl font-bold flex items-center gap-2.5">
                                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isProjectCompleted ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                                                <TrendingUp className={`h-5 w-5 ${isProjectCompleted ? 'text-emerald-600' : 'text-blue-600'}`} />
                                            </div>
                                            {cardTitle}
                                        </CardTitle>
                                        <CardDescription className="mt-1">
                                            {cardDescription}
                                        </CardDescription>
                                    </div>
                                    <Badge className={`text-sm px-3 py-1 ${netProfit >= 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                                        {netProfit >= 0 ? 'PROFITABLE' : 'LOSS'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {(() => {
                                    // For T&M and Retainer projects with no milestones, show a live burn-rate view
                                    if (isNoMilestoneModel) {
                                        const totalBudget = projectBudgetConverted;
                                        const actualLabor = allReportData.filter(r => r.type === 'labor').reduce((acc, r) => acc + getConvertedAmount(r.cost, r.currency), 0);
                                        const actualExpense = allReportData.filter(r => r.type === 'expense').reduce((acc, r) => acc + getConvertedAmount(r.cost, r.currency), 0);
                                        const actualTotal = actualLabor + actualExpense;
                                        const remaining = totalBudget - actualTotal;
                                        const burnPct = totalBudget > 0 ? Math.min(100, (actualTotal / totalBudget) * 100) : 0;
                                        const totalHoursLogged = allReportData.filter(r => r.type === 'labor').reduce((acc, r) => acc + (r.logged || 0), 0);

                                        // Utilization-based health for no-milestone projects
                                        let liveHealthStatus = 'Healthy';
                                        let liveHealthColor = 'text-green-700 bg-green-100 border-green-200';
                                        let liveHealthReason = `Only ${burnPct.toFixed(0)}% of budget consumed. Strong margin maintained.`;
                                        if (burnPct > 100) {
                                            liveHealthStatus = 'Critical';
                                            liveHealthColor = 'text-red-700 bg-red-100 border-red-200';
                                            liveHealthReason = `Budget overrun: ${burnPct.toFixed(0)}% of budget has been consumed.`;
                                        } else if (burnPct >= 90) {
                                            liveHealthStatus = 'High Risk';
                                            liveHealthColor = 'text-orange-700 bg-orange-100 border-orange-200';
                                            liveHealthReason = `High burn rate at ${burnPct.toFixed(0)}%. Very little budget remains.`;
                                        } else if (burnPct >= 80) {
                                            liveHealthStatus = 'At Risk';
                                            liveHealthColor = 'text-yellow-700 bg-yellow-100 border-yellow-200';
                                            liveHealthReason = `${burnPct.toFixed(0)}% of budget consumed. Monitor spend closely.`;
                                        }

                                        const barColor = burnPct > 100 ? 'bg-red-500' : burnPct >= 90 ? 'bg-orange-500' : burnPct >= 80 ? 'bg-yellow-500' : 'bg-emerald-500';

                                        return (
                                            <div className="space-y-5">
                                                {/* Live Burn Rate Summary */}
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">
                                                            {billingModel === 'retainer' ? 'Total Retainer Value' : 'Estimated Budget'}
                                                        </div>
                                                        <div className="text-2xl font-bold text-emerald-700">{formatCurrency(totalBudget, targetCurrency)}</div>
                                                        <div className="text-xs text-slate-400 mt-1">
                                                            {billingModel === 'retainer'
                                                                ? `${budgetMeta.details?.amountPerPeriod ? formatCurrency(getConvertedAmount(budgetMeta.details.amountPerPeriod, project.currency), targetCurrency) : '—'} / ${budgetMeta.details?.period || 'period'}`
                                                                : `${budgetMeta.details?.hours || 0} hrs × ${formatCurrency(getConvertedAmount(budgetMeta.details?.rate || 0, project.currency), targetCurrency)}/hr`
                                                            }
                                                        </div>
                                                    </div>
                                                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Actual Spend</div>
                                                        <div className={`text-2xl font-bold ${actualTotal > totalBudget ? 'text-red-700' : 'text-slate-800'}`}>
                                                            {formatCurrency(actualTotal, targetCurrency)}
                                                        </div>
                                                        <div className="text-xs text-slate-400 mt-1">{burnPct.toFixed(1)}% of budget used</div>
                                                    </div>
                                                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">
                                                            {remaining >= 0 ? 'Budget Remaining' : 'Overspend'}
                                                        </div>
                                                        <div className={`text-2xl font-bold ${remaining >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                                                            {remaining >= 0 ? formatCurrency(remaining, targetCurrency) : `−${formatCurrency(Math.abs(remaining), targetCurrency)}`}
                                                        </div>
                                                        <div className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${liveHealthColor}`}>
                                                            {liveHealthStatus}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Burn Rate Progress Bar */}
                                                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="font-semibold text-slate-700">Budget Burn Rate</span>
                                                        <span className={`font-bold ${burnPct > 100 ? 'text-red-600' : 'text-slate-700'}`}>{burnPct.toFixed(1)}%</span>
                                                    </div>
                                                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-3 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(100, burnPct)}%` }} />
                                                    </div>
                                                    <div className="flex justify-between text-[11px] text-slate-400">
                                                        <span>₹0</span>
                                                        <span>{formatCurrency(totalBudget, targetCurrency)}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 italic">{liveHealthReason}</p>
                                                </div>

                                                {/* Labor vs Expense Breakdown */}
                                                <div className="overflow-x-auto rounded-lg border border-slate-200">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="border-b border-slate-300">
                                                                <TableHead className="font-bold text-slate-900">Category</TableHead>
                                                                <TableHead className="text-right font-bold text-slate-900">Actual Cost</TableHead>
                                                                <TableHead className="text-right font-bold text-slate-900">% of Spend</TableHead>
                                                                <TableHead className="text-right font-bold text-slate-900">% of Budget</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            <TableRow className="border-b border-slate-100 hover:bg-slate-50">
                                                                <TableCell className="font-medium text-blue-700">👷 Labor Costs</TableCell>
                                                                <TableCell className="text-right text-blue-700">{formatCurrency(actualLabor, targetCurrency)}</TableCell>
                                                                <TableCell className="text-right text-slate-600">{actualTotal > 0 ? ((actualLabor / actualTotal) * 100).toFixed(1) : 0}%</TableCell>
                                                                <TableCell className="text-right text-slate-600">{totalBudget > 0 ? ((actualLabor / totalBudget) * 100).toFixed(1) : 0}%</TableCell>
                                                            </TableRow>
                                                            <TableRow className="border-b border-slate-100 hover:bg-slate-50">
                                                                <TableCell className="font-medium text-orange-700">📦 Expense Costs</TableCell>
                                                                <TableCell className="text-right text-orange-700">{formatCurrency(actualExpense, targetCurrency)}</TableCell>
                                                                <TableCell className="text-right text-slate-600">{actualTotal > 0 ? ((actualExpense / actualTotal) * 100).toFixed(1) : 0}%</TableCell>
                                                                <TableCell className="text-right text-slate-600">{totalBudget > 0 ? ((actualExpense / totalBudget) * 100).toFixed(1) : 0}%</TableCell>
                                                            </TableRow>
                                                            <TableRow className="bg-slate-900 hover:bg-slate-900">
                                                                <TableCell className="font-bold text-white uppercase text-sm tracking-wider">Total</TableCell>
                                                                <TableCell className={`text-right font-bold text-lg ${actualTotal > totalBudget ? 'text-red-400' : 'text-white'}`}>
                                                                    {formatCurrency(actualTotal, targetCurrency)}
                                                                </TableCell>
                                                                <TableCell className="text-right text-white font-bold">100%</TableCell>
                                                                <TableCell className={`text-right font-bold ${burnPct > 100 ? 'text-red-400' : 'text-emerald-300'}`}>{burnPct.toFixed(1)}%</TableCell>
                                                            </TableRow>
                                                        </TableBody>
                                                    </Table>
                                                </div>

                                                {/* Profit/Loss Summary Banner */}
                                                <div className={`p-4 rounded-lg border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${remaining >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                                    <div>
                                                        <div className={`text-sm font-bold uppercase tracking-wider ${remaining >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                                                            {isProjectCompleted ? 'Final Profit / Loss' : 'Live Profit / Loss (Projected)'}
                                                        </div>
                                                        <div className="text-xs text-slate-500 mt-0.5">
                                                            {billingModel === 'retainer' ? 'Retainer value vs actual costs' : 'T&M budget estimate vs actual costs'}
                                                        </div>
                                                    </div>
                                                    <div className={`text-2xl sm:text-3xl font-bold ${remaining >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                                        {remaining >= 0 ? '+' : ''}{formatCurrency(remaining, targetCurrency)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // --- MILESTONE / FIXED-PRICE TABLE VIEW ---
                                    // Filter mlist based on selectedMilestone for the P&L Card table
                                    const displayMlist = selectedMilestone === 'all' ? mlist : mlist.filter(m => String(m.milestoneId) === String(selectedMilestone));


                                    // Calculate totals for the selected scope
                                    const totals = displayMlist.reduce((acc, m) => ({
                                        contractAmount: acc.contractAmount + m.contractAmount,
                                        expBudget: acc.expBudget + m.expBudget,
                                        laborCost: acc.laborCost + m.laborCost,
                                        expenseCost: acc.expenseCost + m.expenseCost,
                                        totalCost: acc.totalCost + m.totalPhaseCost,
                                        profit: acc.profit + m.phaseProfit
                                    }), { contractAmount: 0, expBudget: 0, laborCost: 0, expenseCost: 0, totalCost: 0, profit: 0 });

                                    // Handle unallocated costs if showing all
                                    let unallocatedLabor = 0;
                                    let unallocatedExpense = 0;
                                    let hasUnallocated = false;

                                    if (selectedMilestone === 'all') {
                                        const unallocated = allReportData.filter(r => !r.milestoneId);
                                        if (unallocated.length > 0) {
                                            unallocatedLabor = unallocated.filter(r => r.type === 'labor').reduce((acc, r) => acc + r.cost, 0);
                                            unallocatedExpense = unallocated.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.cost, 0);
                                            hasUnallocated = true;
                                            totals.laborCost += unallocatedLabor;
                                            totals.expenseCost += unallocatedExpense;
                                            totals.totalCost += (unallocatedLabor + unallocatedExpense);
                                            totals.profit -= (unallocatedLabor + unallocatedExpense);
                                        }
                                    }

                                    return (
                                        <div className="space-y-4">
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="border-b border-slate-300">
                                                            <TableHead className="font-bold text-slate-900">Phase Name</TableHead>
                                                            <TableHead className="text-right font-bold text-slate-900">Contract Value</TableHead>
                                                            <TableHead className="text-right font-bold text-slate-900">Budgeted Expense</TableHead>
                                                            <TableHead className="text-right font-bold text-slate-900">Actual Labor</TableHead>
                                                            <TableHead className="text-right font-bold text-slate-900">Actual Expense</TableHead>
                                                            <TableHead className="text-right font-bold text-slate-900">Total Cost</TableHead>
                                                            <TableHead className="text-right font-bold text-slate-900">Profit/Loss</TableHead>
                                                            <TableHead className="text-center font-bold text-slate-900">Health</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {displayMlist.map((phase, idx) => (
                                                            <TableRow key={idx} className={`hover:bg-slate-50 border-b border-slate-100 ${selectedMilestone !== 'all' ? 'bg-blue-50/30' : ''}`}>
                                                                <TableCell>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="font-medium text-slate-900">{phase.phaseName}</div>
                                                                        {phase.status === 'completed' && (
                                                                            <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0 gap-1 opacity-80">
                                                                                <Lock className="h-2.5 w-2.5" />
                                                                                Settled
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium text-emerald-700">
                                                                    {formatCurrency(phase.contractAmount, targetCurrency)}
                                                                </TableCell>
                                                                <TableCell className="text-right text-amber-600">
                                                                    {phase.expBudget > 0 ? formatCurrency(phase.expBudget, targetCurrency) : <span className="text-slate-300">—</span>}
                                                                </TableCell>
                                                                <TableCell className="text-right text-blue-700">
                                                                    {formatCurrency(phase.laborCost, targetCurrency)}
                                                                </TableCell>
                                                                <TableCell className="text-right text-orange-700">
                                                                    {formatCurrency(phase.expenseCost, targetCurrency)}
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium text-slate-800">
                                                                    {formatCurrency(phase.totalPhaseCost, targetCurrency)}
                                                                </TableCell>
                                                                <TableCell className={`text-right font-bold ${phase.phaseProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                                                    {formatCurrency(phase.phaseProfit, targetCurrency)}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <div className="flex flex-col items-center gap-1 cursor-help">
                                                                                <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${phase.healthStatus === 'Healthy' ? 'bg-green-100 text-green-700 border border-green-200' :
                                                                                    phase.healthStatus === 'At Risk' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                                                                        phase.healthStatus === 'High Risk' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                                                                            'bg-red-100 text-red-700 border border-red-200'
                                                                                    }`}>
                                                                                    {phase.healthStatus}
                                                                                </div>
                                                                                <span className="text-[10px] text-slate-400 font-medium">{phase.healthScore}%</span>
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent side="right" className="max-w-[200px] text-xs">
                                                                            <p>{phase.healthReason}</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}

                                                        {/* Unallocated costs row */}
                                                        {hasUnallocated && (
                                                            <TableRow className="bg-slate-50 hover:bg-slate-100 border-b border-slate-200">
                                                                <TableCell>
                                                                    <div className="font-medium text-slate-500 italic">Unallocated (No Milestone)</div>
                                                                </TableCell>
                                                                <TableCell className="text-right text-slate-400">—</TableCell>
                                                                <TableCell className="text-right text-slate-400">—</TableCell>
                                                                <TableCell className="text-right text-blue-600">{formatCurrency(unallocatedLabor, targetCurrency)}</TableCell>
                                                                <TableCell className="text-right text-orange-600">{formatCurrency(unallocatedExpense, targetCurrency)}</TableCell>
                                                                <TableCell className="text-right font-medium text-slate-700">
                                                                    {formatCurrency(unallocatedLabor + unallocatedExpense, targetCurrency)}
                                                                </TableCell>
                                                                <TableCell className="text-right text-slate-400">—</TableCell>
                                                                <TableCell className="text-center text-slate-300">—</TableCell>
                                                            </TableRow>
                                                        )}

                                                        {/* Totals Row */}
                                                        <TableRow className="bg-slate-900 hover:bg-slate-900 border-t-2 border-slate-400">
                                                            <TableCell className="font-bold text-white text-sm uppercase tracking-wider">
                                                                {selectedMilestone === 'all' ? 'Grand Total' : 'Phase Total'}
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold text-emerald-300">
                                                                {formatCurrency(totals.contractAmount, targetCurrency)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold text-amber-300">
                                                                {formatCurrency(totals.expBudget, targetCurrency)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold text-blue-300">
                                                                {formatCurrency(totals.laborCost, targetCurrency)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold text-orange-300">
                                                                {formatCurrency(totals.expenseCost, targetCurrency)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold text-white">
                                                                {formatCurrency(totals.totalCost, targetCurrency)}
                                                            </TableCell>
                                                            <TableCell className={`text-right font-bold text-lg ${totals.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {totals.profit >= 0 ? '+' : ''}{formatCurrency(totals.profit, targetCurrency)}
                                                            </TableCell>
                                                            <TableCell />
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                            </div>

                                            {/* Summary Banner */}
                                            <div className={`p-4 rounded-lg border-2 flex items-center justify-between ${totals.profit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                                <div>
                                                    <div className={`text-sm font-bold uppercase tracking-wider ${totals.profit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                                                        {isProjectCompleted ? 'Project Overall Profit/Loss' : 'Phase Profit/Loss Summary'}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-0.5">
                                                        {selectedMilestone === 'all'
                                                            ? `Accumulated across ${milestones.length} phase${milestones.length > 1 ? 's' : ''}${hasUnallocated ? ' + unallocated costs' : ''}`
                                                            : `Data for completed phase: ${selectedM?.name}`}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`text-3xl font-bold ${totals.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                                        {totals.profit >= 0 ? '+' : ''}{formatCurrency(totals.profit, targetCurrency)}
                                                    </div>
                                                    <div className={`text-sm font-medium ${totals.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {totals.contractAmount > 0 ? `${((totals.profit / totals.contractAmount) * 100).toFixed(1)}% margin` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    );
                })()}

                {/* Health Score Thresholds Legend & AI Button */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 sm:gap-6 px-3 sm:px-4 py-3 bg-white rounded-lg border border-slate-200 shadow-sm flex-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 mr-2 tracking-wider">Health Status Thresholds:</span>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-xs font-semibold text-slate-700">Healthy</span>
                            <span className="text-[10px] text-slate-400">(cost used &lt; 80%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            <span className="text-xs font-semibold text-slate-700">At Risk</span>
                            <span className="text-[10px] text-slate-400">(80–90% used)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                            <span className="text-xs font-semibold text-slate-700">High Risk</span>
                            <span className="text-[10px] text-slate-400">(90–100% used)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-xs font-semibold text-slate-700">Critical</span>
                            <span className="text-[10px] text-slate-400">(over budget)</span>
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
                        // Use OVERALL metrics for AI context as requested
                        totalCost: overallTotalCost,
                        projectBudget: overallProjectBudget,
                        netProfit: overallNetProfit,
                        currency: targetCurrency,
                        daysOverdue: project.deadline ? Math.ceil((new Date() - new Date(project.deadline)) / (1000 * 60 * 60 * 24)) : 0,
                        costImpact: (() => {
                            // Estimate daily burn rate based on total cost / total duration so far
                            const start = project.start_date ? new Date(project.start_date) : new Date(new Date().setDate(new Date().getDate() - 30));
                            const durationDays = Math.max(1, Math.ceil((new Date() - start) / (1000 * 60 * 60 * 24)));
                            const dailyBurn = overallTotalCost / durationDays;
                            const daysOver = project.deadline ? Math.ceil((new Date() - new Date(project.deadline)) / (1000 * 60 * 60 * 24)) : 0;
                            return daysOver > 0 ? daysOver * dailyBurn : 0;
                        })(),
                        breakdown: {
                            laborCost: totalLaborCost,
                            nonLaborCost: totalNonLaborCost,
                            nonBillableCost: allReportData.reduce((acc, r) => {
                                if (r.nonBillable > 0) {
                                    return acc + (r.nonBillable * r.hourlyRate); // Estimate cost of non-billable time
                                }
                                return acc;
                            }, 0),
                            phases: mlist
                        }
                    }}

                />

                {/* Main Detail Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Detailed Breakdown</CardTitle>
                        <CardDescription>Comprehensive list of all labor and non-labor costs</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-6">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">Type</TableHead>
                                        <TableHead>Phase/Sprint</TableHead>
                                        <TableHead>Task/Category</TableHead>
                                        <TableHead>Person/Vendor</TableHead>
                                        <TableHead className="text-center">Billable Hrs</TableHead>
                                        <TableHead className="text-center">Non-Billable</TableHead>
                                        <TableHead className="text-center">Rate ({targetCurrency})</TableHead>
                                        <TableHead className="text-center">Orig. Cost</TableHead>
                                        <TableHead className="text-center font-bold">Total ({targetCurrency})</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredReportData.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-8 text-slate-500 italic">
                                                No financial records found for this scope
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredReportData.map((row, idx) => (
                                            <TableRow key={idx} className="hover:bg-slate-50 border-b border-slate-300 last:border-0">
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${row.type === 'labor' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                            {row.type === 'labor' ? 'Labor' : 'Expense'}
                                                        </span>
                                                        {(() => {
                                                            const milestone = row.milestoneId ? milestones.find(m => (m.id || m._id) === row.milestoneId) : null;
                                                            const isSettled = (milestone?.status === 'completed') || (!row.milestoneId && project?.status === 'completed');
                                                            if (isSettled) {
                                                                return (
                                                                    <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px] font-bold uppercase tracking-wider px-1 py-0 gap-1 opacity-80 scale-90">
                                                                        <Lock className="h-2.5 w-2.5" />
                                                                        Settled
                                                                    </Badge>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
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
                        </div>
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
        </TooltipProvider>
    );
}

