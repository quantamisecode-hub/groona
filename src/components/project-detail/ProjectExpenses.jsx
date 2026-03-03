import React, { useState, useMemo, useEffect } from "react";
import axios from 'axios';
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, DollarSign, TrendingUp, AlertCircle, Trash2, Edit, Check, X, Upload, Loader2, Settings, Lock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PermissionGuard } from "../shared/PermissionGuard";
import UpdateBudgetDialog from "./UpdateBudgetDialog";

const categoryColors = {
  labor: "bg-blue-100 text-blue-800",
  materials: "bg-green-100 text-green-800",
  equipment: "bg-purple-100 text-purple-800",
  software: "bg-cyan-100 text-cyan-800",
  travel: "bg-amber-100 text-amber-800",
  consulting: "bg-indigo-100 text-indigo-800",
  other: "bg-slate-100 text-slate-800",
};

const statusColors = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function ProjectExpenses({ projectId, currentUser, project }) {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showForecast, setShowForecast] = useState(false);
  const [forecast, setForecast] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [showUpdateBudget, setShowUpdateBudget] = useState(false);
  const [conversionRates, setConversionRates] = useState({});
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  const [formData, setFormData] = useState({
    amount: "",
    currency: project?.currency || project?.budget_currency || "USD",
    description: "",
    category: "other",
    date: new Date().toISOString().split('T')[0],
    notes: "",
    milestone_id: "",
  });

  // Keep form currency in sync with project currency for new expenses
  React.useEffect(() => {
    if (project?.currency && !editingExpense) {
      setFormData(prev => ({ ...prev, currency: project.currency }));
    }
  }, [project?.currency, editingExpense]);

  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id
    ? currentUser.active_tenant_id
    : currentUser?.tenant_id;

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['project-expenses', projectId],
    queryFn: () => groonabackend.entities.ProjectExpense.filter({ project_id: projectId }, '-date'),
    enabled: !!projectId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => groonabackend.entities.User.list(),
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['project-timesheets', projectId],
    queryFn: () => groonabackend.entities.Timesheet.filter({ project_id: projectId, status: 'approved' }),
    enabled: !!projectId,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      const all = await groonabackend.entities.Milestone.list();
      return all.filter(m => {
        const mPid = typeof m.project_id === 'object' ? m.project_id.id : m.project_id;
        return mPid === projectId;
      });
    },
    enabled: !!projectId,
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data) => {
      const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner' || currentUser?.is_super_admin;

      const expenseData = {
        ...data,
        tenant_id: effectiveTenantId,
        project_id: projectId,
        incurred_by: currentUser.email,
        incurred_by_name: currentUser.full_name,
        status: isAdmin ? 'approved' : 'pending', // Auto-approve for admins
      };

      if (isAdmin) {
        expenseData.approved_by = currentUser.email;
        expenseData.approved_at = new Date().toISOString();
      }

      return groonabackend.entities.ProjectExpense.create(expenseData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-expenses', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setShowAddDialog(false);
      setFormData({
        amount: "",
        currency: project?.currency || project?.budget_currency || "USD",
        description: "",
        category: "other",
        date: new Date().toISOString().split('T')[0],
        notes: "",
        milestone_id: "",
      });
      toast.success('Expense added successfully');
    },
    onError: () => toast.error('Failed to add expense'),
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, data }) => groonabackend.entities.ProjectExpense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-expenses', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setEditingExpense(null);
      setShowAddDialog(false);
      toast.success('Expense updated successfully');
    },
    onError: () => toast.error('Failed to update expense'),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id) => groonabackend.entities.ProjectExpense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-expenses', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Expense deleted successfully');
    },
    onError: () => toast.error('Failed to delete expense'),
  });

  const updateBudgetMutation = useMutation({
    mutationFn: (data) => groonabackend.entities.Project.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowUpdateBudget(false);
      toast.success('Project budget updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update budget', {
        description: error.message || 'Please try again.'
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingExpense) {
      updateExpenseMutation.mutate({ id: editingExpense.id, data: formData });
    } else {
      createExpenseMutation.mutate(formData);
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      amount: expense.amount,
      currency: expense.currency,
      description: expense.description,
      category: expense.category,
      date: expense.date,
      notes: expense.notes || "",
      milestone_id: expense.milestone_id || "",
    });
    setShowAddDialog(true);
  };

  const handleApprove = (expense) => {
    updateExpenseMutation.mutate({
      id: expense.id,
      data: {
        status: 'approved',
        approved_by: currentUser.email,
        approved_at: new Date().toISOString(),
      }
    });
  };

  const handleReject = (expense) => {
    updateExpenseMutation.mutate({
      id: expense.id,
      data: {
        status: 'rejected',
        approved_by: currentUser.email,
        approved_at: new Date().toISOString(),
      }
    });
  };

  const handleGenerateForecast = async () => {
    setLoadingForecast(true);
    setShowForecast(true);
    try {
      const result = await groonabackend.functions.invoke('forecastProjectCost', { project_id: projectId });
      setForecast(result.data);
    } catch (error) {
      toast.error('Failed to generate forecast');
      setShowForecast(false);
    } finally {
      setLoadingForecast(false);
    }
  };

  const targetCurrency = project?.currency || project?.budget_currency || 'USD';

  // Fetch exchange rates
  useEffect(() => {
    const fetchRates = async () => {
      // Collect currencies from Expenses AND Timesheets
      const expenseCurrencies = expenses.map(e => e.currency);
      const timesheetCurrencies = timesheets.map(t => t.currency || 'USD').filter(Boolean);
      // Also maybe check user currencies if timesheet currency is missing?
      const userCurrencies = users.map(u => u.ctc_currency || u.currency).filter(Boolean);

      const allSource = [...new Set([...expenseCurrencies, ...timesheetCurrencies, ...userCurrencies])];
      const sourceCurrencies = allSource.filter(c => c && c !== targetCurrency);

      if (sourceCurrencies.length === 0) return;

      setIsLoadingRates(true);
      const newRates = { ...conversionRates };

      try {
        await Promise.all(sourceCurrencies.map(async (source) => {
          const key = `${source}_${targetCurrency}`;
          if (newRates[key]) return;

          try {
            const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
            const response = await axios.get(`${apiBase}/api/currency/convert`, {
              params: { from: source, to: targetCurrency, amount: 1 }
            });
            if (response.data.rate) {
              newRates[key] = response.data.rate;
            }
          } catch (err) {
            console.error(`Failed to fetch rate for ${source}`, err);
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
    fetchRates();
  }, [expenses, timesheets, users, targetCurrency]);

  const getConvertedAmount = (amount, sourceCurrency) => {
    if (!amount) return 0;
    if (!sourceCurrency || sourceCurrency === targetCurrency) return amount;
    const key = `${sourceCurrency}_${targetCurrency}`;
    const rate = conversionRates[key];
    return rate ? amount * rate : amount;
  };

  const calculatedFinancials = useMemo(() => {
    // 1. Calculate Labor Cost (from Approved Timesheets)
    let totalLaborCost = 0;
    timesheets.forEach(t => {
      const user = users.find(u => u.email === t.user_email);
      // Prioritize snapshot rate (new then old), else user rate
      // Rate Logic - Strictly prefer snapshot
      let rate = 0;
      // Ensure we handle string/number conversion safely and check for null/undefined/0
      // Prioritize snapshot_hourly_rate, then snapshot_rate (legacy), then hourly_rate (from timesheet), then user profile rate
      if (t.snapshot_hourly_rate !== undefined && t.snapshot_hourly_rate !== null && Number(t.snapshot_hourly_rate) > 0) {
        rate = Number(t.snapshot_hourly_rate);
      } else if (t.snapshot_rate !== undefined && t.snapshot_rate !== null && Number(t.snapshot_rate) > 0) {
        rate = Number(t.snapshot_rate);
      } else if (t.hourly_rate !== undefined && t.hourly_rate !== null && Number(t.hourly_rate) > 0) {
        rate = Number(t.hourly_rate);
      } else {
        rate = Number(user?.hourly_rate || 0);
      }

      if (t.is_billable) {
        const hours = (t.total_minutes || 0) / 60;
        // Determine Source Currency: t.currency -> user.currency -> project fallback?
        // Determine Source Currency: Prioritize User CTC Currency to match Profitability Detail
        // ProjectProfitabilityDetail uses user?.ctc_currency || 'INR' (ignoring t.currency)
        const sourceCurrency = user?.ctc_currency || user?.currency || 'USD';

        // Convert Rate to Target Project Currency
        const convertedRate = getConvertedAmount(rate, sourceCurrency);
        totalLaborCost += (hours * convertedRate);
      }
    });

    // 2. Calculate Non-Labor Expenses (Approved Only)
    let totalNonLaborCost = 0;
    let pendingNonLaborCost = 0;

    expenses.forEach(e => {
      const amount = getConvertedAmount(e.amount || 0, e.currency);
      if (e.status === 'approved') {
        totalNonLaborCost += amount;
      } else if (e.status === 'pending') {
        pendingNonLaborCost += amount;
      }
    });

    const totalSpent = totalLaborCost + totalNonLaborCost;

    // Budget Calculation based on Billing Model
    let budget = 0;
    let budgetLabel = "Total Budget";

    switch (project?.billing_model) {
      case 'fixed_price':
        budget = Number(project.contract_amount || project.budget || 0);
        budgetLabel = "Contract Amount";
        break;
      case 'retainer':
        budget = Number(project.retainer_amount || project.contract_amount || project.budget || 0);
        budgetLabel = "Retainer Amount";
        break;
      case 'time_and_materials':
        const duration = Number(project.estimated_duration || 0);
        const rate = Number(project.default_bill_rate_per_hour || 0);
        budget = duration * rate;
        budgetLabel = "Est. T&M Value";
        break;
      case 'non_billable':
        budget = 0;
        budgetLabel = "Non-Billable";
        break;
      default:
        budget = Number(project?.budget || project?.budget_amount || 0);
        budgetLabel = "Total Budget";
    }

    // Budget Used % = (Labor Cost + Non-Labor Cost) ÷ Expense Budget × 100
    // Remaining = Expense Budget − Total Spent
    // For T&M: expense_budget × estimated_duration = total expense budget
    // For all other models: expense_budget is used directly
    const rawExpenseBudget = Number(project?.expense_budget || 0);
    const expenseBudgetValue = project?.billing_model === 'time_and_materials'
      ? rawExpenseBudget * Number(project?.estimated_duration || 0)
      : rawExpenseBudget;

    const remaining = expenseBudgetValue - totalSpent;
    const percentUsed = expenseBudgetValue > 0 ? (totalSpent / expenseBudgetValue) * 100 : 0;

    return {
      totalLaborCost,
      totalNonLaborCost,
      pendingNonLaborCost,
      totalSpent,
      budget,
      budgetLabel,
      remaining,
      percentUsed,
      expenseBudgetValue
    };
  }, [timesheets, users, expenses, conversionRates, targetCurrency, project]);

  const { totalSpent, remaining, percentUsed, pendingNonLaborCost, budget, budgetLabel, totalLaborCost, totalNonLaborCost, expenseBudgetValue } = calculatedFinancials;

  const expenseBudget = Number(project?.expense_budget || 0);

  const getCurrencySymbol = (code) => {
    const map = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'dh' };
    return map[code] || code;
  };
  const currSymbol = getCurrencySymbol(targetCurrency);

  return (
    <div className="space-y-6">
      {/* Budget Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">

        {/* Contract Budget */}
        <Card className="shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-600 mb-1 leading-tight">{budgetLabel}</p>
                <p className="text-lg font-bold text-slate-900 truncate">
                  {targetCurrency} {budget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="p-1.5 bg-green-50 rounded-lg ml-2 shrink-0">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expense Budget */}
        <Card className="shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-600 mb-1 leading-tight">Expense Budget</p>
                <p className={`text-lg font-bold truncate ${expenseBudgetValue > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                  {expenseBudgetValue > 0
                    ? `${targetCurrency} ${expenseBudgetValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : '—'}
                </p>
              </div>
              <div className="p-1.5 bg-blue-50 rounded-lg ml-2 shrink-0">
                <DollarSign className="h-4 w-4 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Labor Cost */}
        <Card className="shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-600 mb-1 leading-tight">Total Labor Cost</p>
                <p className="text-lg font-bold text-indigo-900 truncate">
                  {targetCurrency} {totalLaborCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="p-1.5 bg-indigo-50 rounded-lg ml-2 shrink-0">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Non-Labor Cost */}
        <Card className="shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-600 mb-1 leading-tight">Total Non-Labor Cost</p>
                <p className="text-lg font-bold text-orange-900 truncate">
                  {targetCurrency} {totalNonLaborCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="p-1.5 bg-orange-50 rounded-lg ml-2 shrink-0">
                <DollarSign className="h-4 w-4 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Remaining */}
        <Card className="shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-600 mb-1 leading-tight">Remaining</p>
                <p className={`text-lg font-bold truncate ${remaining < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {targetCurrency} {remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className={`p-1.5 rounded-lg ml-2 shrink-0 ${remaining < 0 ? 'bg-red-50' : 'bg-amber-50'}`}>
                <AlertCircle className={`h-4 w-4 ${remaining < 0 ? 'text-red-500' : 'text-amber-500'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget Used % */}
        <Card className="shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-600 mb-1 leading-tight">Budget Used</p>
                <p className={`text-lg font-bold ${percentUsed > 100 ? 'text-red-600' :
                  percentUsed > 80 ? 'text-amber-600' :
                    'text-green-600'
                  }`}>
                  {percentUsed.toFixed(1)}%
                </p>
                <div className="mt-1.5 w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${percentUsed > 100 ? 'bg-red-500' :
                      percentUsed > 80 ? 'bg-amber-500' :
                        'bg-green-500'
                      }`}
                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                  />
                </div>
              </div>
              <div className={`p-1.5 rounded-lg ml-2 shrink-0 ${percentUsed > 100 ? 'bg-red-50' : percentUsed > 80 ? 'bg-amber-50' : 'bg-green-50'
                }`}>
                <AlertCircle className={`h-4 w-4 ${percentUsed > 100 ? 'text-red-500' : percentUsed > 80 ? 'text-amber-500' : 'text-green-500'
                  }`} />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Budget Usage</span>
              <span className={percentUsed > 90 ? 'text-red-600 font-bold' : 'text-slate-900'}>
                {percentUsed.toFixed(1)}%
              </span>
            </div>
            <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${percentUsed > 100 ? 'bg-red-500' :
                  percentUsed > 90 ? 'bg-amber-500' :
                    'bg-green-500'
                  }`}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              />
            </div>
            {pendingNonLaborCost > 0 && (
              <p className="text-xs text-amber-600">
                {targetCurrency} {pendingNonLaborCost.toLocaleString()} pending approval (expenses)
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Expense Button */}
      <div className="flex justify-end">
        <PermissionGuard permission="can_manage_project_expenses" context={{ project }}>
          <Button onClick={() => { setEditingExpense(null); setShowAddDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        </PermissionGuard>
      </div>

      {/* Expenses List */}
      <Card>
        <CardHeader>
          <CardTitle>Expense History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No expenses recorded yet
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-slate-900">{expense.description}</h4>
                      <Badge className={categoryColors[expense.category]}>
                        {expense.category}
                      </Badge>
                      <Badge className={statusColors[expense.status]}>
                        {expense.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span>{expense.currency} {expense.amount.toLocaleString()}</span>
                      <span>•</span>
                      <span>{format(new Date(expense.date), 'MMM d, yyyy')}</span>
                      <span>•</span>
                      <span>By {expense.incurred_by_name}</span>
                      {expense.milestone_id && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Settings className="w-3 h-3" />
                            {milestones.find(m => (m.id || m._id) === expense.milestone_id)?.name || 'Unknown Milestone'}
                          </span>
                        </>
                      )}
                    </div>
                    {expense.notes && (
                      <p className="text-xs text-slate-500 mt-1">{expense.notes}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {(() => {
                      const isLocked = (expense.milestone_id && milestones.find(m => (m.id || m._id) === expense.milestone_id)?.status === 'completed') || project?.status === 'completed';

                      if (isLocked) {
                        return (
                          <div className="flex items-center text-slate-400 bg-slate-100 px-3 py-1 rounded-md border border-slate-200 gap-2 opacity-70">
                            <Lock className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Settled</span>
                          </div>
                        );
                      }

                      return (
                        <>
                          {expense.status === 'pending' && (
                            <PermissionGuard permission="can_manage_project_expenses" context={{ project }}>
                              <Button size="sm" variant="outline" onClick={() => handleApprove(expense)}>
                                <Check className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleReject(expense)}>
                                <X className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </PermissionGuard>
                          )}
                          <PermissionGuard permission="can_manage_project_expenses" context={{ project }}>
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(expense)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm('Delete this expense?')) {
                                  deleteExpenseMutation.mutate(expense.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </PermissionGuard>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Budget Dialog */}
      <UpdateBudgetDialog
        open={showUpdateBudget}
        onClose={() => setShowUpdateBudget(false)}
        onSubmit={(data) => updateBudgetMutation.mutate(data)}
        project={project}
        loading={updateBudgetMutation.isPending}
      />

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Edit' : 'Add'} Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Amount ({formData.currency})</label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>



            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="labor">Labor</SelectItem>
                  <SelectItem value="materials">Materials</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="software">Software</SelectItem>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="consulting">Consulting</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Date</label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Milestone (Optional)</label>
              <Select value={formData.milestone_id} onValueChange={(val) => setFormData({ ...formData, milestone_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Milestone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General Project / No Milestone</SelectItem>
                  {milestones
                    .filter(m => m.status === 'in_progress' || (formData.milestone_id && (m.id === formData.milestone_id || m._id === formData.milestone_id)))
                    .map((m) => (
                      <SelectItem key={m.id || m._id} value={m.id || m._id}>
                        {m.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createExpenseMutation.isPending || updateExpenseMutation.isPending}>
                {(createExpenseMutation.isPending || updateExpenseMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingExpense ? 'Update' : 'Add'} Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

