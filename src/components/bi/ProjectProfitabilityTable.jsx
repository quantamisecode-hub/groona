import React, { useState, useMemo } from 'react';
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ChevronDown, ChevronRight, Banknote, TrendingUp, TrendingDown, AlertCircle, RefreshCw, PieChart, Briefcase, HelpCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import axios from 'axios';
import TaskDetailDialog from "@/components/tasks/TaskDetailDialog";
import { useNavigate } from 'react-router-dom';

const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'JPY', 'CNY', 'CHF', 'HKD', 'NZD', 'SEK', 'KRW', 'MXN', 'BRL', 'ZAR'];

export default function ProjectProfitabilityTable({ projects, users, timesheets, tasks = [], sprints = [], onRefresh }) {
  const navigate = useNavigate();
  // const [expandedProjects, setExpandedProjects] = useState({}); // Removed expand logic
  // const [expandedProjects, setExpandedProjects] = useState({}); // Removed expand logic
  const [selectedProject, setSelectedProject] = useState('all');
  const [targetCurrency, setTargetCurrency] = useState('INR');
  const [conversionRates, setConversionRates] = useState({});
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 500); // Minimum spin time
  };

  // Fetch all expenses to integrate Non-Labor Costs
  const { data: allExpenses = [] } = useQuery({
    queryKey: ['all-project-expenses'],
    queryFn: () => groonabackend.entities.ProjectExpense.list(),
  });

  // Fetch exchange rates when currencies change
  React.useEffect(() => {
    const fetchRates = async () => {
      // Identify unique source currencies from projects, users, expenses
      const sourceCurrencies = new Set();
      projects.forEach(p => { if (p.currency) sourceCurrencies.add(p.currency); });
      users.forEach(u => { if (u.ctc_currency) sourceCurrencies.add(u.ctc_currency); }); // Add user currencies

      // We only need to fetch if source is different from target
      const pairsToFetch = [...sourceCurrencies].filter(c => c && c !== targetCurrency);

      if (pairsToFetch.length === 0) return;

      setIsLoadingRates(true);
      const newRates = { ...conversionRates };

      try {
        await Promise.all(pairsToFetch.map(async (source) => {
          const key = `${source}_${targetCurrency}`;
          if (newRates[key]) return; // Already have it

          try {
            // Using our Backend API which handles Caching (Fixer.io)
            // Endpoint: /api/currency/convert
            const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
            const response = await axios.get(`${apiBase}/api/currency/convert`, {
              params: {
                from: source,
                to: targetCurrency,
                amount: 1
              }
            });

            // Backend returns: { rate: 1.23, result: 1.23, ... }
            const rate = response.data.rate;

            if (rate) {
              newRates[key] = rate;
            }
          } catch (err) {
            console.error(`Failed to fetch rate for ${source} -> ${targetCurrency}`, err);
          }
        }));

        setConversionRates(newRates);
      } catch (error) {
        console.error("Error fetching rates", error);
      } finally {
        setIsLoadingRates(false);
      }
    };

    fetchRates();
  }, [projects, users, targetCurrency]);

  const getConvertedAmount = (amount, sourceCurrency) => {
    if (!amount) return 0;
    if (sourceCurrency === targetCurrency) return amount;
    // Handle Identity if source is missing or matches target
    if (!sourceCurrency) return amount;

    const key = `${sourceCurrency}_${targetCurrency}`;
    const rate = conversionRates[key];

    if (rate !== undefined) {
      return amount * rate;
    }

    return amount; // Fallback to original if no rate yet
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

  const toggleProject = (projectId) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  const formatCurrency = (amount, currency = 'INR') => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount || 0);
    } catch (e) {
      return `${currency} ${amount?.toFixed(0) || 0}`;
    }
  };

  const formatPercent = (percent) => {
    return `${(percent || 0).toFixed(1)}%`;
  };

  const processedData = useMemo(() => {
    if (!projects.length || !timesheets.length) return { rows: [], aggregates: {} };

    // Filter timesheets by project
    const filteredTimesheets = timesheets.filter(t => {
      const projectId = typeof t.project_id === 'object' ? t.project_id.id : t.project_id;
      return selectedProject === 'all' || projectId === selectedProject;
    });

    const filteredExpenses = allExpenses.filter(e => {
      if (e.status === 'rejected') return false;
      const ep = e.project_id || e.project || e.projectId;
      const pId = typeof ep === 'object' ? (ep.id || ep._id) : ep;
      const projectWait = selectedProject === 'all' || String(pId) === String(selectedProject);
      return projectWait;
    });

    const projectGroups = {};
    const expenseGroups = {}; // store non-labor expenses per project

    // Group Expenses by Project
    filteredExpenses.forEach(e => {
      const ep = e.project_id || e.project || e.projectId;
      const pId = typeof ep === 'object' ? (ep.id || ep._id) : ep;
      if (!pId) return;
      // Expense amount is in its own currency, needs conversion logic if we want to sum accurately relative to project currency?
      // Actually, best to store raw amount and currency and convert later, OR assuming we convert to Project Currency first?
      // The table displays row in Project Currency or Target Currency.
      // Let's store raw objects for more accurate conversion.
      if (!expenseGroups[pId]) expenseGroups[pId] = [];
      expenseGroups[pId].push(e);
    });

    // Helper to find user details
    const getUserInfo = (email) => {
      return users.find(user => user.email === email);
    };

    // Helper to find Task/Sprint details
    const getTaskInfo = (taskId) => {
      const id = typeof taskId === 'object' ? taskId.id : taskId; // Handle OID
      return tasks.find(t => t.id === id);
    };
    const getSprintInfo = (sprintId) => {
      const id = typeof sprintId === 'object' ? sprintId.id : sprintId; // Handle OID
      return sprints.find(s => s.id === id);
    };

    filteredTimesheets.forEach(t => {
      const projectId = typeof t.project_id === 'object' ? t.project_id.id : t.project_id;

      // Initialize Project Group if missing
      if (!projectGroups[projectId]) {
        const project = projects.find(p => p.id === projectId) || { name: 'Unknown Project', budget: 0, currency: 'INR' };

        // Calculate Revenue / Budget based on Billing Model
        let revenueAmount = 0;
        let revenueLabel = "Contract Amount";

        switch (project.billing_model) {
          case 'fixed_price':
            revenueAmount = Number(project.contract_amount || project.budget || 0);
            revenueLabel = "Fixed Price";
            break;
          case 'retainer':
            revenueAmount = Number(project.retainer_amount || project.contract_amount || project.budget || 0);
            revenueLabel = "Retainer Amt";
            break;
          case 'time_and_materials': {
            const duration = Number(project.estimated_duration || 0);
            const rate = Number(project.default_bill_rate_per_hour || 0);
            revenueAmount = duration * rate;
            revenueLabel = "Est. T&M Value";
            break;
          }
          case 'non_billable':
            revenueAmount = 0;
            revenueLabel = "Non-Billable";
            break;
          default:
            revenueAmount = Number(project.contract_amount || project.budget || 0);
        }

        projectGroups[projectId] = {
          projectObj: project,
          revenueAmount,
          revenueLabel,
          details: {}, // Grouped by User+Sprint+Task
          totalLoggedMinutes: 0,
          totalApprovedBillableMinutes: 0,
          totalCtcSpent: 0, // Approved Billable Cost
          totalLoggedLaborCost: 0, // All hours cost
        };
      }

      const pGroup = projectGroups[projectId];
      pGroup.totalLoggedMinutes += (t.total_minutes || 0);

      // Unique Key for Detail Row: User + Sprint + Task
      // This ensures we show granular "Sprint Name" and "Task Title" as requested
      const detailsKey = `${t.user_email}_${t.sprint_id}_${t.task_id}`;

      if (!pGroup.details[detailsKey]) {
        const user = getUserInfo(t.user_email);
        const task = getTaskInfo(t.task_id);
        const sprint = getSprintInfo(t.sprint_id);

        pGroup.details[detailsKey] = {
          userName: user ? user.full_name : t.user_email,
          userEmail: t.user_email,
          userHourlyRate: user ? (user.hourly_rate || 0) : 0,
          userCurrency: user?.ctc_currency || 'INR', // Default to INR if missing

          taskId: task ? task.id : null,
          taskTitle: task ? task.title : 'General Task',
          sprintName: sprint ? sprint.name : 'Backlog/General',
          loggedMinutes: 0,
          approvedBillableMinutes: 0,
          ctcSpent: 0,

          // Rate Calc Trackers
          totalBillableMinutes: 0,
          totalBillableCost: 0,
          lastSnapshotRate: 0
        };
      }

      const dGroup = pGroup.details[detailsKey];
      dGroup.loggedMinutes += (t.total_minutes || 0);

      // Rate Logic matching ProjectProfitabilityDetail
      let currentRateRaw = 0;
      if (t.snapshot_hourly_rate !== undefined && t.snapshot_hourly_rate !== null && Number(t.snapshot_hourly_rate) > 0) {
        currentRateRaw = Number(t.snapshot_hourly_rate);
      } else if (t.snapshot_rate !== undefined && t.snapshot_rate !== null && Number(t.snapshot_rate) > 0) {
        currentRateRaw = Number(t.snapshot_rate);
      } else if (t.hourly_rate !== undefined && t.hourly_rate !== null && Number(t.hourly_rate) > 0) {
        currentRateRaw = Number(t.hourly_rate);
      } else {
        currentRateRaw = dGroup.userHourlyRate;
      }

      // Calculate Effective Rate in Project Currency
      const projectCurrency = pGroup.projectObj.currency || 'INR';
      const conversionRate = getRate(dGroup.userCurrency, projectCurrency);
      const effectiveRateProjectCurrency = currentRateRaw * conversionRate;

      if (effectiveRateProjectCurrency > 0 && (!dGroup.lastSnapshotRate || dGroup.lastSnapshotRate === 0)) {
        dGroup.lastSnapshotRate = effectiveRateProjectCurrency;
      }

      if (t.is_billable) {
        dGroup.totalBillableMinutes += (t.total_minutes || 0);
        dGroup.totalBillableCost += ((t.total_minutes || 0) / 60) * effectiveRateProjectCurrency;
      }

      // Calculate ALL labor cost for leakage tracking
      const costForLeakage = ((t.total_minutes || 0) / 60) * effectiveRateProjectCurrency;
      pGroup.totalLoggedLaborCost += costForLeakage;

      // Cost and Approved Hours Logic: Strictly Approved AND Billable
      if (t.status === 'approved' && t.is_billable) {
        pGroup.totalApprovedBillableMinutes += (t.total_minutes || 0);
        dGroup.approvedBillableMinutes += (t.total_minutes || 0);

        const cost = ((t.total_minutes || 0) / 60) * effectiveRateProjectCurrency;
        dGroup.ctcSpent += cost;
        pGroup.totalCtcSpent += cost;
      }
    });

    // Format Data for UI
    const finalRows = Object.values(projectGroups).map(group => {
      const detailRows = Object.values(group.details).map(d => {
        const billableHours = d.totalBillableMinutes / 60;
        // Effective Rate Calc: Weighted Avg -> Last Snapshot -> Profile
        let effectiveRate = billableHours > 0 ? (d.totalBillableCost / billableHours) : 0;
        if (!effectiveRate || effectiveRate === 0) {
          effectiveRate = d.lastSnapshotRate || d.userHourlyRate;
        }

        return {
          userName: d.userName,
          sprintName: d.sprintName,
          taskId: d.taskId,
          taskTitle: d.taskTitle,
          hourlyRate: effectiveRate,
          loggedHours: d.loggedMinutes / 60,
          approvedHours: d.approvedBillableMinutes / 60,
          cost: d.ctcSpent
        };
      });

      const pId = group.projectObj.id;

      // Calculate Non-Labor Cost for this project
      let totalNonLaborCostProjectCurrency = 0;
      const projectCurrency = group.projectObj.currency || 'INR';

      const pExpenses = Array.isArray(expenseGroups[pId]) ? expenseGroups[pId] : [];
      pExpenses.forEach(e => {
        // We must convert expense amount (e.currency) to Project Currency (projectCurrency)
        // We can use getConvertedAmount helper but we need to ensure we have the rate.
        // getConvertedAmount uses `conversionRates` state.

        // Note: getConvertedAmount(amount, source) converts to `targetCurrency` (Global State).
        // BUT here we want to sum it up for the "Project Row" which shows values in `project.currency`.
        // This is tricky. 
        // If display is "Converted (Target)", we can just convert everything to Target.
        // But the column "CTC Spent" is in Project Currency.
        // So "Non-Labor Expenses" column should also be in Project Currency?
        // Yes.

        // We need e.currency -> projectCurrency.
        // Our `conversionRates` are keyed as `source_target`.
        // If we don't have direct `e.currency_projectCurrency`, we might struggle.
        // However, usually expenses are entered in project currency.
        // Let's assume for now expenses ARE in project currency OR we try to convert.

        // Simplified approach: Convert everything to `targetCurrency` for the "Converted" columns.
        // For the "Original" columns, if e.currency != project.currency, strictly speaking we can't sum them simply.
        // But let's assume `e.currency` matches `project.currency` for valid summation in "Original" column, 
        // OR convert using our rate helper if possible.

        // Let's rely on `getConvertedAmount` which converts to `targetCurrency`.
        // So we will calculate `totalNonLaborCostConverted` directly.
        // And for `totalNonLaborCostOriginal`, we simply sum if currencies match, else... it's mixed bag.

        // Actually, let's just use `getConvertedAmount` to convert to TARGET first, 
        // and for the "Project Currency" column... maybe we display converted value if currency differs?
        // Or just strictly sum assuming same currency. 
        // Most users maintain project expenses in project currency.

        if (e.currency === projectCurrency) {
          totalNonLaborCostProjectCurrency += (e.amount || 0);
        } else if (projectCurrency === targetCurrency) {
          // If the Project Currency matches our Target Currency (which we have rates for),
          // we can correctly convert the expense to Project Currency.
          totalNonLaborCostProjectCurrency += getConvertedAmount(e.amount, e.currency);
        } else {
          // Fallback: If expense is USD, Project is EUR, and Target is INR.
          // We can't easily convert USD->EUR without extra rates.
          // Keep existing behavior (raw sum) or marked as estimate.
          totalNonLaborCostProjectCurrency += (e.amount || 0);
        }
      });

      // Re-calculate Converted Non-Labor Cost strictly:
      const totalNonLaborCostConverted = pExpenses.reduce((sum, e) => {
        return sum + getConvertedAmount(e.amount, e.currency);
      }, 0);

      const totalLaborCost = group.totalCtcSpent;
      const totalCost = totalLaborCost + totalNonLaborCostProjectCurrency;

      // Expense Budget (multiplied by estimated duration for T&M)
      const rawExpenseBudget = Number(group.projectObj.expense_budget || 0);
      const expenseBudgetValue = group.projectObj.billing_model === 'time_and_materials'
        ? rawExpenseBudget * Number(group.projectObj.estimated_duration || 0)
        : rawExpenseBudget;
      const budgetUsedPercent = expenseBudgetValue > 0 ? (totalCost / expenseBudgetValue) * 100 : null;

      // Profit Leakage Calculation by Model
      let laborLeakage = Math.max(0, group.totalLoggedLaborCost - group.totalCtcSpent);
      let expenseOverrun = Math.max(0, totalNonLaborCostProjectCurrency - expenseBudgetValue);
      let projectLeakage = 0;

      switch (group.projectObj.billing_model) {
        case 'fixed_price':
          // Leakage = Overrun (Cost > Revenue) + Unapproved/Unbillable labor
          projectLeakage = Math.max(0, totalCost - group.revenueAmount) + laborLeakage;
          break;
        case 'retainer':
          // Leakage = Over-service (Cost > Retainer)
          projectLeakage = Math.max(0, totalCost - group.revenueAmount);
          break;
        case 'time_and_materials':
          // Leakage = Every unbillable/unapproved hour cost
          projectLeakage = laborLeakage;
          break;
        case 'non_billable':
          // Leakage = 100% of spending (Bench Cost)
          projectLeakage = totalCost;
          break;
        default:
          projectLeakage = laborLeakage;
      }

      return {
        id: group.projectObj.id,
        projectName: group.projectObj.name,
        currency: group.projectObj.currency || 'INR',
        billing_model: group.projectObj.billing_model,
        allocatedBudget: group.revenueAmount,
        revenueLabel: group.revenueLabel,
        totalLoggedHours: group.totalLoggedMinutes / 60,
        totalApprovedHours: group.totalApprovedBillableMinutes / 60,
        totalLaborCost: totalLaborCost,
        totalNonLaborCost: totalNonLaborCostProjectCurrency,
        totalNonLaborCostConverted: totalNonLaborCostConverted,
        totalCost: totalCost,
        expenseBudgetValue,
        budgetUsedPercent,
        projectLeakage,
        milestoneCoverage: tasks.filter(tsk => tsk.project_id === group.projectObj.id).length > 0
          ? (tasks.filter(tsk => tsk.project_id === group.projectObj.id && tsk.milestone_id).length / tasks.filter(tsk => tsk.project_id === group.projectObj.id).length) * 100
          : 0,
        details: detailRows
      };
    });

    // We also need to map projects that have EXPENSES but NO TIMESHEETS
    // Currently `Object.values(projectGroups)` only iterates sets created from timesheets.
    // We must ensure all relevant projects are included.
    const projectsWithOnlyExpenses = filteredExpenses.reduce((acc, e) => {
      const pId = typeof e.project_id === 'object' ? e.project_id.id : e.project_id;
      if (!projectGroups[pId] && !acc.includes(pId)) {
        acc.push(pId);
      }
      return acc;
    }, []);

    projectsWithOnlyExpenses.forEach(pId => {
      // Create a dummy row for project with expenses only
      const project = projects.find(p => p.id === pId) || { name: 'Unknown Project', budget: 0, currency: 'INR' };
      const pExpenses = expenseGroups[pId] || [];

      let totalNonLaborCostProjectCurrency = 0;
      const projectCurrency = project.currency || 'INR';

      const totalNonLaborCostConverted = pExpenses.reduce((sum, e) => {
        if (e.currency === projectCurrency) {
          totalNonLaborCostProjectCurrency += (e.amount || 0);
        } else if (projectCurrency === targetCurrency) {
          totalNonLaborCostProjectCurrency += getConvertedAmount(e.amount, e.currency);
        } else {
          totalNonLaborCostProjectCurrency += (e.amount || 0);
        }
        return sum + getConvertedAmount(e.amount, e.currency);
      }, 0);

      const rawExpenseBudget2 = Number(project.expense_budget || 0);
      const expenseBudgetValue2 = project.billing_model === 'time_and_materials'
        ? rawExpenseBudget2 * Number(project.estimated_duration || 0)
        : rawExpenseBudget2;
      const budgetUsedPercent2 = expenseBudgetValue2 > 0
        ? (totalNonLaborCostProjectCurrency / expenseBudgetValue2) * 100
        : null;

      // Calculate revenue correctly based on billing model (same as timesheet path)
      let revenueAmount2 = 0;
      switch (project.billing_model) {
        case 'fixed_price':
          revenueAmount2 = Number(project.contract_amount || project.budget || 0);
          break;
        case 'retainer':
          revenueAmount2 = Number(project.retainer_amount || project.contract_amount || project.budget || 0);
          break;
        case 'time_and_materials': {
          const dur = Number(project.estimated_duration || 0);
          const rt = Number(project.default_bill_rate_per_hour || 0);
          revenueAmount2 = dur * rt;
          break;
        }
        case 'non_billable':
          revenueAmount2 = 0;
          break;
        default:
          revenueAmount2 = Number(project.contract_amount || project.budget || 0);
      }

      const revenueLabelMap = {
        fixed_price: 'Fixed Price',
        retainer: 'Retainer Amt',
        time_and_materials: 'Est. T&M Value',
        non_billable: 'Non-Billable',
      };

      // Profit Leakage for Expense-Only projects
      let projectLeakage2 = 0;
      if (project.billing_model === 'non_billable') {
        projectLeakage2 = totalNonLaborCostProjectCurrency;
      } else if (project.billing_model === 'fixed_price' || project.billing_model === 'retainer') {
        projectLeakage2 = Math.max(0, totalNonLaborCostProjectCurrency - revenueAmount2);
      } else {
        // T&M mostly has expense overruns as leakage if billable
        projectLeakage2 = Math.max(0, totalNonLaborCostProjectCurrency - expenseBudgetValue2);
      }

      finalRows.push({
        id: project.id,
        projectName: project.name,
        currency: projectCurrency,
        billing_model: project.billing_model,
        revenueLabel: revenueLabelMap[project.billing_model] || 'Budget',
        allocatedBudget: revenueAmount2,
        totalLoggedHours: 0,
        totalApprovedHours: 0,
        totalLaborCost: 0,
        totalNonLaborCost: totalNonLaborCostProjectCurrency,
        totalNonLaborCostConverted: totalNonLaborCostConverted,
        totalCost: totalNonLaborCostProjectCurrency,
        expenseBudgetValue: expenseBudgetValue2,
        budgetUsedPercent: budgetUsedPercent2,
        projectLeakage: projectLeakage2,
        details: []
      });

    });

    // Remove rows for unresolvable projects (no matching project record in the data)
    const knownRows = finalRows.filter(r => r.projectName !== 'Unknown Project');
    finalRows.length = 0;
    knownRows.forEach(r => finalRows.push(r));

    // Aggregates for summary cards

    // Revenue: Based on Allocated Budget of visible projects
    const totalRevenue = finalRows.reduce((sum, r) => sum + (r.allocatedBudget || 0), 0);
    // Calculated based on Converted Target Currency to ensure apples-to-apples summary
    // Wait, earlier code summed `r.totalCost` directly for `totalCost`. 
    // `r.totalCost` is in Project Currency. Summing them is wrong if currencies differ.
    // We should use converted values for aggregation.

    // Converted Aggregates
    const totalRevenueConverted = finalRows.reduce((sum, r) => sum + getConvertedAmount(r.allocatedBudget || 0, r.currency), 0);

    // Split Labor vs Non-Labor Aggregates
    const totalLaborCostConverted = finalRows.reduce((sum, r) => sum + getConvertedAmount(r.totalLaborCost, r.currency), 0);
    const totalNonLaborCostConverted = finalRows.reduce((sum, r) => sum + r.totalNonLaborCostConverted, 0);

    const totalCostConverted = totalLaborCostConverted + totalNonLaborCostConverted;
    const totalProfitConverted = totalRevenueConverted - totalCostConverted;
    const totalLeakageConverted = finalRows.reduce((sum, r) => sum + getConvertedAmount(r.projectLeakage || 0, r.currency), 0);

    // For "Original" aggregates (mixed currencies), we just sum them for display "Orig" (often meaningless but requested)
    const totalCost = finalRows.reduce((sum, r) => sum + r.totalCost, 0);
    const totalProfit = totalRevenue - totalCost; // Mixed currency profit

    const overallMargin = totalRevenueConverted > 0 ? (totalProfitConverted / totalRevenueConverted) * 100 : 0;
    const overallLeakagePercent = totalRevenueConverted > 0 ? (totalLeakageConverted / totalRevenueConverted) * 100 : 0;

    // Expense Budget aggregates (converted to target)
    const totalExpenseBudgetConverted = finalRows.reduce((sum, r) => {
      return sum + getConvertedAmount(r.expenseBudgetValue || 0, r.currency);
    }, 0);
    const overallBudgetUsedPercent = totalExpenseBudgetConverted > 0
      ? (totalCostConverted / totalExpenseBudgetConverted) * 100
      : null;

    return {
      rows: finalRows,
      aggregates: {
        totalRevenue, totalCost, totalProfit, overallMargin,
        totalRevenueConverted, totalLaborCostConverted, totalNonLaborCostConverted, totalCostConverted, totalProfitConverted,
        totalExpenseBudgetConverted, overallBudgetUsedPercent, totalLeakageConverted, overallLeakagePercent,
        overallMilestoneCoverage: tasks.length > 0 ? (tasks.filter(t => t.milestone_id).length / tasks.length) * 100 : 0
      }
    };
  }, [timesheets, projects, users, tasks, sprints, conversionRates, targetCurrency, selectedProject]);

  const getStatusColor = (margin) => {
    if (margin > 20) return "text-green-600 bg-green-100";
    if (margin >= 10) return "text-yellow-600 bg-yellow-100";
    if (margin >= 0) return "text-orange-600 bg-orange-100";
    return "text-red-600 bg-red-100";
  };

  const getStatusLabel = (margin) => {
    if (margin > 20) return "Healthy";
    if (margin >= 10) return "Warning";
    if (margin >= 0) return "Risk";
    return "Loss";
  };

  const handleTaskClick = (taskId) => {
    if (taskId) {
      setSelectedTaskId(taskId);
      setIsTaskDetailOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Date Filter & Currency Selector */}
      <div className="flex flex-wrap items-end gap-4 bg-white/50 p-4 rounded-xl border border-slate-100 backdrop-blur-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Project</label>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[200px] bg-white text-left">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Currency</label>
          <Select value={targetCurrency} onValueChange={setTargetCurrency}>
            <SelectTrigger className="w-[100px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button
            variant="outline"
            onClick={handleRefresh}
            title="Refresh Data"
            className="h-10 px-4 bg-white border-slate-200 gap-2 font-medium text-slate-700"
          >
            <RefreshCw className={`h-4 w-4 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </Button>
        </div>
      </div>

      {/* Header Row with Legend */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-indigo-600" />
            Overall Company Profitability
          </h3>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-indigo-600">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-4 text-xs shadow-xl" align="start">
              <div className="space-y-4">
                <h4 className="font-semibold text-sm border-b pb-2 mb-2">How Metrics are Calculated</h4>

                <div className="grid grid-cols-[1fr_2fr] gap-2">
                  <span className="font-semibold text-blue-700">Labor Cost:</span>
                  <span className="text-slate-600">Sum of (Logged Hours × User Hourly Rate) for all employees across selected period.</span>

                  <span className="font-semibold text-amber-700">Non-Labor:</span>
                  <span className="text-slate-600">Total of all <strong>Approved</strong> project expenses (software, travel, etc.).</span>

                  <span className="font-semibold text-green-700">Profit:</span>
                  <span className="text-slate-600">Revenue (Budget/Retainer) - (Labor Cost + Non-Labor Cost).</span>

                  <span className="font-semibold text-purple-700">Margin %:</span>
                  <span className="text-slate-600">(Net Profit / Total Revenue) × 100.</span>
                </div>

                <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-100 italic text-[10px] text-slate-500">
                  * Currencies are automatically converted to the selected target currency for aggregation.
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Compact Legend */}
        <div className="flex items-center gap-4 text-xs font-medium text-slate-600 bg-white/50 px-4 py-2 rounded-full border border-slate-200/60 backdrop-blur-sm">
          <span className="text-slate-500">Margin:</span>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>{'>'}20%</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>10-20%</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>0-10%</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>{'<'}0%</div>
        </div>
      </div>

      {/* Summary Cards Grid - 9 columns */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-9 gap-3 mb-8">

        {/* Contract Amount */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-600 mb-1 leading-tight">Contract Amount ({targetCurrency})</p>
                <h3 className="text-lg font-bold text-green-700 truncate">
                  {formatCurrency(processedData.aggregates.totalRevenueConverted, targetCurrency)}
                </h3>
              </div>
              <div title="Sum of all project contract/retainer/T&M budgets" className="p-1.5 bg-green-50 rounded-lg cursor-help ml-2 shrink-0">
                <Banknote className="h-4 w-4 text-green-600 opacity-80" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Labor Cost */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-600 mb-1 leading-tight">Total Labor Cost ({targetCurrency})</p>
                <h3 className="text-lg font-bold text-slate-900 truncate">
                  {formatCurrency(processedData.aggregates.totalLaborCostConverted, targetCurrency)}
                </h3>
              </div>
              <div title="Sum of Employee Costs" className="p-1.5 bg-blue-50 rounded-lg cursor-help ml-2 shrink-0">
                <Banknote className="h-4 w-4 text-blue-600 opacity-80" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Non-Labor Cost */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-600 mb-1 leading-tight">Total Non-Labor ({targetCurrency})</p>
                <h3 className="text-lg font-bold text-slate-900 truncate">
                  {formatCurrency(processedData.aggregates.totalNonLaborCostConverted, targetCurrency)}
                </h3>
              </div>
              <div title="Sum of Expenses" className="p-1.5 bg-amber-50 rounded-lg cursor-help ml-2 shrink-0">
                <Banknote className="h-4 w-4 text-amber-600 opacity-80" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Profit / Loss */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-600 mb-1 leading-tight">Total Profit / Loss ({targetCurrency})</p>
                <h3 className={`text-lg font-bold truncate ${processedData.aggregates.totalProfitConverted >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(processedData.aggregates.totalProfitConverted, targetCurrency)}
                </h3>
              </div>
              <div title="Revenue - Cost" className={`ml-2 p-1.5 rounded-lg cursor-help shrink-0 ${processedData.aggregates.totalProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <TrendingUp className={`h-4 w-4 ${processedData.aggregates.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profit Margin % */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-600 mb-1 leading-tight">
                  {processedData.aggregates.overallMargin < 0 ? 'Profit Leakage %' : 'Profit Margin %'}
                </p>
                <h3 className={`text-lg font-bold ${getStatusColor(processedData.aggregates.overallMargin).split(' ')[0]}`}>
                  {formatPercent(processedData.aggregates.overallMargin)}
                </h3>
              </div>
              <div title="(Profit / Revenue) * 100" className="p-1.5 bg-purple-50 rounded-lg cursor-help ml-2 shrink-0">
                <AlertCircle className="h-4 w-4 text-purple-600 opacity-80" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profit Leakage */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-600 mb-1 leading-tight text-red-600">Profit Leakage ({targetCurrency})</p>
                <h3 className={`text-lg font-bold truncate ${processedData.aggregates.totalLeakageConverted > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                  {formatCurrency(processedData.aggregates.totalLeakageConverted, targetCurrency)}
                </h3>
                {processedData.aggregates.totalLeakageConverted > 0 && (
                  <p className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">
                    {processedData.aggregates.overallLeakagePercent.toFixed(1)}% of Revenue
                  </p>
                )}
              </div>
              <div title="Unbillable hours, bench cost, or budget overruns" className="p-1.5 bg-red-50 rounded-lg cursor-help ml-2 shrink-0">
                <TrendingDown className="h-4 w-4 text-red-500 opacity-80" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expense Budget */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-600 mb-1 leading-tight">Expense Budget ({targetCurrency})</p>
                <h3 className={`text-lg font-bold truncate ${processedData.aggregates.totalExpenseBudgetConverted > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                  {processedData.aggregates.totalExpenseBudgetConverted > 0
                    ? formatCurrency(processedData.aggregates.totalExpenseBudgetConverted, targetCurrency)
                    : '—'}
                </h3>
              </div>
              <div className="p-1.5 bg-blue-50 rounded-lg ml-2 shrink-0">
                <Banknote className="h-4 w-4 text-blue-500 opacity-80" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget Used % */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-600 mb-1 leading-tight">Budget Used %</p>
                {processedData.aggregates.overallBudgetUsedPercent != null ? (
                  <div className="flex flex-col">
                    <h3 className={`text-lg font-bold ${processedData.aggregates.overallBudgetUsedPercent > 100 ? 'text-red-600' :
                      processedData.aggregates.overallBudgetUsedPercent > 80 ? 'text-amber-600' :
                        'text-green-600'
                      }`}>
                      {processedData.aggregates.overallBudgetUsedPercent.toFixed(1)}%
                    </h3>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {formatCurrency(processedData.aggregates.totalCostConverted, targetCurrency)} of {formatCurrency(processedData.aggregates.totalExpenseBudgetConverted, targetCurrency)}
                    </p>
                    <div className="mt-1.5 w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${processedData.aggregates.overallBudgetUsedPercent > 100 ? 'bg-red-500' :
                          processedData.aggregates.overallBudgetUsedPercent > 80 ? 'bg-amber-500' :
                            'bg-green-500'
                          }`}
                        style={{ width: `${Math.min(100, processedData.aggregates.overallBudgetUsedPercent)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <h3 className="text-lg font-bold text-slate-400">—</h3>
                )}
              </div>
              <div className="p-1.5 bg-indigo-50 rounded-lg ml-2 shrink-0">
                <AlertCircle className="h-4 w-4 text-indigo-500 opacity-80" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-600 mb-1 leading-tight">Status</p>
                <Badge className={`mt-0.5 text-xs font-medium px-2 py-0.5 ${getStatusColor(processedData.aggregates.overallMargin)} border-none shadow-none`}>
                  {getStatusLabel(processedData.aggregates.overallMargin)}
                </Badge>
              </div>
              <div className={`p-1.5 rounded-lg shrink-0 ml-2 ${getStatusColor(processedData.aggregates.overallMargin).split(' ')[1].replace('100', '50')}`}>
                <TrendingUp className={`h-4 w-4 ${getStatusColor(processedData.aggregates.overallMargin).split(' ')[0]}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg font-bold text-slate-900">Project Profitability Details</CardTitle>
          </div>
          <CardDescription className="text-slate-500 pl-7">
            Detailed breakdown by Project, and drill down to Sprint/Task/Employee
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow className="border-b border-slate-200 hover:bg-transparent">
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead className="font-bold text-slate-900 text-center">Project</TableHead>
                  <TableHead className="text-center font-bold text-slate-900">Contract Amount</TableHead>
                  <TableHead className="text-center font-bold text-blue-700">Converted ({targetCurrency})</TableHead>
                  <TableHead className="text-center font-bold text-slate-900">Total Logged</TableHead>
                  <TableHead className="text-center font-bold text-slate-900">Approved Billable</TableHead>
                  <TableHead className="text-center font-bold text-slate-900">Labor Cost</TableHead>
                  <TableHead className="text-center font-bold text-slate-900">Non-Labor Exp</TableHead>
                  <TableHead className="text-center font-bold text-slate-900">Total Cost</TableHead>
                  <TableHead className="text-center font-bold text-blue-700">Converted Cost ({targetCurrency})</TableHead>
                  <TableHead className="text-center font-bold text-red-700">Leakage</TableHead>
                  <TableHead className="text-center font-bold text-blue-700">Expense Budget</TableHead>
                  <TableHead className="text-center font-bold text-blue-700">Budget Used %</TableHead>
                  <TableHead className="text-center font-bold text-slate-900">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedData.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center text-slate-500">
                      No data found for the selected period.
                    </TableCell>
                  </TableRow>
                ) : (
                  processedData.rows.map((project) => (
                    <React.Fragment key={project.id}>
                      {/* Parent Project Row */}
                      <TableRow
                        className="cursor-pointer hover:bg-slate-50/80 transition-colors border-b border-slate-300"
                        onClick={() => toggleProject(project.id)}
                      >
                        <TableCell>
                          {/* Removed Expansion Icon */}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900 text-center">{project.projectName}</TableCell>
                        <TableCell className="text-center font-medium text-slate-600">
                          <div className="flex flex-col items-center gap-0.5">
                            <span>{formatCurrency(project.allocatedBudget, project.currency)}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium uppercase tracking-wide">
                              {project.revenueLabel || project.billing_model || 'Budget'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium text-blue-600">
                          {formatCurrency(getConvertedAmount(project.allocatedBudget, project.currency), targetCurrency)}
                        </TableCell>
                        <TableCell className="text-center text-slate-600">{project.totalLoggedHours.toFixed(2)} h</TableCell>
                        <TableCell className="text-center text-slate-600">{project.totalApprovedHours.toFixed(2)} h</TableCell>
                        <TableCell className="text-center font-medium text-slate-600">
                          {formatCurrency(project.totalLaborCost, project.currency)}
                        </TableCell>
                        <TableCell className="text-center font-medium text-slate-600">
                          {formatCurrency(project.totalNonLaborCost, project.currency)}
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-900">
                          {formatCurrency(project.totalCost, project.currency)}
                        </TableCell>
                        <TableCell className="text-center font-bold text-blue-700">
                          {/* Calculate Total Converted Cost for this Row */}
                          {formatCurrency(
                            getConvertedAmount(project.totalLaborCost, project.currency) + project.totalNonLaborCostConverted,
                            targetCurrency
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold text-red-600">
                          {project.projectLeakage > 0 ? formatCurrency(project.projectLeakage, project.currency) : '—'}
                        </TableCell>
                        <TableCell className="text-center font-medium text-blue-600">
                          {project.expenseBudgetValue > 0 ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span>{formatCurrency(project.expenseBudgetValue, project.currency)}</span>
                              {project.billing_model === 'time_and_materials' && (
                                <span className="text-[10px] text-slate-400">exp_budget × duration</span>
                              )}
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {project.budgetUsedPercent != null
                            ? (
                              <span className={
                                project.budgetUsedPercent > 100 ? 'text-red-600' :
                                  project.budgetUsedPercent > 80 ? 'text-amber-600' :
                                    'text-green-600'
                              }>
                                {project.budgetUsedPercent.toFixed(1)}%
                              </span>
                            )
                            : <span className="text-slate-400">—</span>
                          }
                        </TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/ProjectProfitabilityDetail?projectId=${project.id}`); }}>
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>

                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Task Detail Dialog */}
      {selectedTaskId && (
        <TaskDetailDialog
          open={isTaskDetailOpen}
          onClose={() => setIsTaskDetailOpen(false)}
          taskId={selectedTaskId}
          readOnly={true} // Reports are usually read-only, but can be toggled
        />
      )}
    </div>
  );
}

