import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { BrainCircuit, AlertTriangle, Clock, Activity, Zap, Loader2, Target, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/api/groonabackend';

export default function AIInsightsModal({ open, onClose, project, metrics }) {
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (open && project && metrics) {
            fetchAIAnalysis();
        }
    }, [open, project?.id, project?._id]);

    const fetchAIAnalysis = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.post(`${API_URL}/ai/analyze-profitability`, {
                project,
                metrics
            });
            setAiAnalysis(response.data);
        } catch (err) {
            console.error('Failed to fetch AI analysis:', err);
            setError('Could not reach AI analysis service. Showing heuristic data instead.');
        } finally {
            setLoading(false);
        }
    };

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

    // Determine the AI analysis to display, with a fallback
    const analysis = aiAnalysis || {
        primaryDriver: "Unknown",
        analysisPoints: ["Failed to get AI insights. Showing heuristic data."],
        recommendations: ["Review project metrics manually.", "Ensure API service is running and accessible."],
        overallHealth: "N/A"
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
                                {project?.status === 'completed'
                                    ? (isOverBudget ? 'Financial Post-Mortem' : 'Efficiency Review')
                                    : (isOverBudget ? 'Cost Overrun Analysis' : 'Profitability Health Check')}
                            </DialogTitle>
                            <DialogDescription>
                                {project?.status === 'completed'
                                    ? `Final evaluation of ${project.name}'s financial performance and lessons.`
                                    : `Real-time analysis of ${project.name}'s current ${isOverBudget ? 'overruns' : 'efficiency'}.`}
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
                            <BrainCircuit className={`h-4 w-4 ${isOverBudget ? 'text-red-600' : 'text-emerald-600'}`} />
                            DEEP AI ANALYSIS (GROONA AI POWERED)
                        </h3>

                        <div className="space-y-4 relative z-10">
                            <div className={`bg-white/60 p-5 rounded-lg border backdrop-blur-sm ${isOverBudget ? 'border-red-100/50' : 'border-emerald-100/50'}`}>
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-8 gap-3 text-slate-500">
                                        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                                        <div className="text-sm font-medium animate-pulse">Consulting Groona AI for deep insights...</div>
                                    </div>
                                ) : error || !aiAnalysis ? (
                                    <div className="space-y-4">
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
                                        {error && <p className="text-[10px] text-red-500 italic mt-2">{error}</p>}
                                    </div>
                                ) : (
                                    <div className="space-y-5">
                                        {(() => {
                                            const renderBoldContent = (text) => {
                                                if (!text) return null;
                                                const parts = text.split(/(\*\*.*?\*\*)/g);
                                                return parts.map((part, i) => {
                                                    if (part.startsWith('**') && part.endsWith('**')) {
                                                        return <strong key={i} className="text-slate-900 font-bold bg-indigo-50/50 px-1 rounded">{part.slice(2, -2)}</strong>;
                                                    }
                                                    return part;
                                                });
                                            };
                                            return (
                                                <div className="space-y-5">
                                                    <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase">Primary Driver</span>
                                                            <span className="text-md font-bold text-indigo-700 uppercase tracking-tight">{aiAnalysis.primaryDriver}</span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase">AI Health Rating</span>
                                                            <div className={`text-sm font-black px-2 py-0.5 rounded ${aiAnalysis.overallHealth === 'Healthy' ? 'bg-green-100 text-green-700' :
                                                                aiAnalysis.overallHealth === 'At Risk' ? 'bg-yellow-100 text-yellow-700' :
                                                                    aiAnalysis.overallHealth === 'High Risk' ? 'bg-orange-100 text-orange-700' :
                                                                        'bg-red-100 text-red-700'
                                                                }`}>
                                                                {aiAnalysis.overallHealth}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {aiAnalysis.analysisPoints.map((point, idx) => (
                                                            <div key={idx} className="flex gap-3 text-sm text-slate-700 leading-relaxed">
                                                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                                                <span>{renderBoldContent(point)}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="mt-4 p-4 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Target className="h-4 w-4 text-indigo-600" />
                                                            <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">Groona AI Recommendations</span>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {(aiAnalysis.recommendations || [aiAnalysis.recommendation]).filter(Boolean).map((rec, idx) => (
                                                                <div key={idx} className="flex gap-3 text-sm text-indigo-900 font-medium group">
                                                                    <div className="mt-1 h-5 w-5 rounded bg-white shadow-sm flex items-center justify-center shrink-0 border border-indigo-100 group-hover:bg-indigo-600 transition-colors">
                                                                        <span className="text-[10px] font-bold text-indigo-600 group-hover:text-white uppercase">{idx + 1}</span>
                                                                    </div>
                                                                    <div className="bg-white/40 p-2 rounded border border-white/50 w-full group-hover:border-indigo-200 group-hover:bg-white/80 transition-all">
                                                                        {renderBoldContent(rec)}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
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
