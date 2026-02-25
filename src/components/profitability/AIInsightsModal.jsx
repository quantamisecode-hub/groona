import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { BrainCircuit, AlertTriangle, Clock, Activity, Zap } from 'lucide-react';

export default function AIInsightsModal({ open, onClose, project, metrics }) {
    if (!metrics) return null;

    const { totalCost, projectBudget, netProfit, currency, daysOverdue, costImpact, breakdown } = metrics;
    const isOverBudget = netProfit < 0;
    const varianceAmount = Math.abs(netProfit);

    // Helper for currency formatting
    const formatMoney = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // --- Dynamic Analysis Logic ---
    let varianceData = [];
    let explanationItems = [];

    if (isOverBudget) {
        // 1. Calculate Contributors to the Overrun (Variance)
        // We try to attribute the varianceAmount to specific buckets

        const nonLaborContribution = breakdown?.nonLaborCost || 0;
        const nonBillableContribution = breakdown?.nonBillableCost || 0;

        // Labor Overrun: Assume any remaining variance is due to Labor Overrun (Under-estimation / Inefficiency)
        // Note: This is a simplification. Real variance = (Actual Labor + Actual Expenses) - Budget.
        // We allocate Expense cost first, then Non-Billable, then the rest is "Core Labor Overrun".

        let remainingVariance = varianceAmount;

        // Bucket 1: Expenses (Non-Labor)
        // If we have expenses, they are a direct cost.
        // Heuristic: If expenses are > 20% of budget, they are a major driver.
        // We aggressively attribute expenses to variance if we are over budget.
        const expenseShare = Math.min(remainingVariance, nonLaborContribution);
        remainingVariance -= expenseShare;

        // Bucket 2: Non-Billable Time (Inefficiency)
        const inefficiencyShare = Math.min(remainingVariance, nonBillableContribution);
        remainingVariance -= inefficiencyShare;

        // Bucket 3: Estimation Error (The Rest)
        const laborOverrunShare = remainingVariance;

        // Build the Data Array
        if (expenseShare > 0) {
            const pct = Math.round((expenseShare / varianceAmount) * 100);
            varianceData.push({
                label: "Non-Labor / Expenses",
                value: expenseShare,
                percentage: pct,
                color: "bg-red-500",
                detail: "High operational or capital expenses"
            });
            explanationItems.push({ pct, text: "due to high non-labor expenses", color: "bg-red-500" });
        }

        if (inefficiencyShare > 0) {
            const pct = Math.round((inefficiencyShare / varianceAmount) * 100);
            varianceData.push({
                label: "Idle / Non-Billable",
                value: inefficiencyShare,
                percentage: pct,
                color: "bg-yellow-500",
                detail: "Cost of non-billable hours logged"
            });
            explanationItems.push({ pct, text: "due to non-billable resource time", color: "bg-yellow-500" });
        }

        if (laborOverrunShare > 0) {
            const pct = Math.round((laborOverrunShare / varianceAmount) * 100);
            varianceData.push({
                label: "Estimation Error",
                value: laborOverrunShare,
                percentage: pct,
                color: "bg-orange-500",
                detail: "Labor hours exceeded initial budget"
            });
            explanationItems.push({ pct, text: "due to under-estimation of labor effort", color: "bg-orange-500" });
        }

    } else {
        // Under Budget Logic (Savings)
        varianceData = [
            { label: "Cost Savings", value: varianceAmount, percentage: 100, color: "bg-emerald-500", detail: "Efficient resource utilization" }
        ];
        explanationItems.push({ pct: 100, text: "savings from efficient execution", color: "bg-emerald-500" });
    }

    // Sort by value desc
    varianceData.sort((a, b) => b.value - a.value);
    explanationItems.sort((a, b) => b.pct - a.pct);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${isOverBudget ? 'from-red-500 to-orange-600 shadow-red-500/20' : 'from-emerald-500 to-teal-600 shadow-emerald-500/20'} flex items-center justify-center shadow-lg`}>
                            {isOverBudget ? <AlertTriangle className="h-6 w-6 text-white" /> : <Zap className="h-6 w-6 text-white" />}
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-slate-900">
                                {isOverBudget ? 'Cost Overrun Analysis' : 'Efficiency Analysis'}
                            </DialogTitle>
                            <DialogDescription>
                                Automated analysis of {isOverBudget ? 'cost variance and leakages' : 'cost savings and efficiency'}.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-8 mt-4">

                    {/* Section 1: Variance Decomposition Model */}
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-slate-500" />
                            {isOverBudget ? 'Variance Decomposition Model' : 'Savings Decomposition Model'}
                        </h3>

                        <div className="space-y-6">
                            {varianceData.map((item, index) => (
                                <div key={index} className="space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-semibold text-slate-700">{item.label}</span>
                                        <span className="font-medium text-slate-600">
                                            {formatMoney(item.value)} <span className="text-slate-400 text-xs ml-1">({item.percentage}%)</span>
                                        </span>
                                    </div>
                                    <div className="relative h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className={`absolute top-0 left-0 h-full ${item.color} rounded-full`}
                                            style={{ width: `${item.percentage}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 italic flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        {item.detail}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section 2: Executive Explanation */}
                    <div className={`bg-gradient-to-br ${isOverBudget ? 'from-white to-red-50 border-red-100' : 'from-white to-emerald-50 border-emerald-100'} p-6 rounded-xl border shadow-sm relative overflow-hidden`}>
                        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 ${isOverBudget ? 'bg-red-500/5' : 'bg-emerald-500/5'}`} />

                        <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${isOverBudget ? 'text-red-900' : 'text-emerald-900'}`}>
                            <Zap className={`h-4 w-4 ${isOverBudget ? 'text-red-600' : 'text-emerald-600'}`} />
                            EXECUTIVE EXPLANATION (AUTO-GENERATED)
                        </h3>

                        <div className="space-y-4 relative z-10">
                            <div className={`bg-white/60 p-4 rounded-lg border backdrop-blur-sm ${isOverBudget ? 'border-red-100/50' : 'border-emerald-100/50'}`}>
                                <p className="text-lg font-semibold text-slate-800 mb-3">
                                    {isOverBudget
                                        ? `Why did ${project.name} exceed budget by ${formatMoney(varianceAmount)}?`
                                        : `How did ${project.name} save ${formatMoney(varianceAmount)} against budget?`
                                    }
                                </p>
                                <ul className="space-y-3">
                                    {explanationItems.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                                            <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.color}`} />
                                            <span>
                                                <strong className="text-slate-900">{item.pct}%</strong> {item.text}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Deadline Impact Message */}
                            {isOverBudget && daysOverdue > 0 && (
                                <div className="flex items-center gap-3 bg-red-50 p-3 rounded-lg border border-red-100 text-red-800 text-sm">
                                    <Clock className="h-4 w-4 flex-shrink-0" />
                                    <span className="font-semibold">
                                        Project exceeded by {daysOverdue} days → {formatMoney(costImpact)} cost impact.
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
}
