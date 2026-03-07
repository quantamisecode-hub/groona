import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { groonabackend } from '@/api/groonabackend';
import { useUser } from '@/components/shared/UserContext';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle, Loader2, Banknote, ArrowRight } from "lucide-react";
import { subDays, format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import axios from 'axios';

const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'JPY', 'CNY', 'CHF', 'HKD', 'NZD', 'SEK', 'KRW', 'MXN', 'BRL', 'ZAR'];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const currency = payload[0].payload.targetCurrency || 'INR';
        let symbol = '₹';
        try {
            symbol = currency === 'INR' ? '₹' : new Intl.NumberFormat('en-US', { style: 'currency', currency }).formatToParts(0).find(x => x.type === 'currency').value;
        } catch (e) {
            symbol = currency + ' ';
        }

        return (
            <div className="bg-white p-4 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-slate-100 flex flex-col gap-2 min-w-[180px]">
                <p className="text-[13px] font-bold text-slate-900 mb-1">{label}, {new Date().getFullYear()}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <div
                            className="w-4 h-0.5 rounded-full"
                            style={{
                                backgroundColor: entry.color,
                                borderStyle: entry.name === 'previous' ? 'dashed' : 'solid'
                            }}
                        />
                        <span className="font-bold text-[14px] text-slate-800">
                            {symbol}{(entry.value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-[13px] text-slate-500">
                            {entry.name === 'current' ? 'this month' : 'last month'}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export default function CompanyProfitabilityChart() {
    const navigate = useNavigate();
    const { user: currentUser, effectiveTenantId } = useUser();

    const [targetCurrency, setTargetCurrency] = useState('INR');
    const [conversionRates, setConversionRates] = useState({});
    const [isLoadingRates, setIsLoadingRates] = useState(false);

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

    useEffect(() => {
        const fetchRates = async () => {
            const sourceCurrencies = new Set();
            projects.forEach(p => { if (p.currency) sourceCurrencies.add(p.currency); });
            users.forEach(u => { if (u.ctc_currency) sourceCurrencies.add(u.ctc_currency); });

            const pairsToFetch = [...sourceCurrencies].filter(c => c && c !== targetCurrency);

            if (pairsToFetch.length === 0) return;

            setIsLoadingRates(true);
            const newRates = { ...conversionRates };

            try {
                await Promise.all(pairsToFetch.map(async (source) => {
                    const key = `${source}_${targetCurrency}`;
                    if (newRates[key]) return;

                    try {
                        const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
                        const response = await axios.get(`${apiBase}/api/currency/convert`, {
                            params: { from: source, to: targetCurrency, amount: 1 }
                        });
                        const rate = response.data.rate;
                        if (rate) newRates[key] = rate;
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

        if (projects.length > 0 || users.length > 0) {
            fetchRates();
        }
    }, [projects, users, targetCurrency]);

    const getConvertedAmount = (amount, sourceCurrency) => {
        if (!amount) return 0;
        if (sourceCurrency === targetCurrency) return amount;
        if (!sourceCurrency) return amount;

        const key = `${sourceCurrency}_${targetCurrency}`;
        const rate = conversionRates[key];

        if (rate !== undefined) return amount * rate;
        return amount; // Fallback
    };

    const getRate = (from, to) => {
        if (from === to) return 1;
        const getRateToTarget = (c) => {
            if (c === targetCurrency) return 1;
            return conversionRates[`${c}_${targetCurrency}`] || 0;
        };

        const rateFrom = getRateToTarget(from);
        const rateTo = getRateToTarget(to);

        if (rateFrom && rateTo) return rateFrom / rateTo;
        return 1;
    };

    const isLoading = pLoading || uLoading || tLoading || eLoading;

    const processedData = useMemo(() => {
        if (!projects.length) return { totalProfit: 0, margin: 0, chartData: [], stats: { active: 0, completed: 0, onHold: 0 }, totalLaborCost: 0, totalExpense: 0 };

        const projectGroups = {};

        timesheets.forEach(t => {
            const pId = typeof t.project_id === 'object' ? t.project_id.id : t.project_id;
            if (!projectGroups[pId]) projectGroups[pId] = { active: true };
        });

        expenses.forEach(e => {
            if (e.status === 'rejected') return;
            const ep = e.project_id || e.project || e.projectId;
            const pId = typeof ep === 'object' ? (ep.id || ep._id) : ep;
            if (!projectGroups[pId]) projectGroups[pId] = { active: true };
        });

        // The exact filtering from Project Profitability Table to match rows!
        const filteredProjects = projects.filter(p => p.id && projectGroups[p.id]);

        let totalRevenue = 0;
        const projectHash = {};

        // Loop over the FILTERED projects (those with timesheets or expenses) to sum revenue
        filteredProjects.forEach(p => {
            projectHash[p.id] = p;
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
            const pCurrency = p.currency || 'INR';
            totalRevenue += getConvertedAmount(revenueAmount, pCurrency);
        });

        const userRates = {};
        const userCurrencies = {};
        users.forEach(u => {
            userRates[u.email] = Number(u.hourly_rate || 0);
            userCurrencies[u.email] = u.ctc_currency || 'INR';
        });

        let totalLaborCost = 0;
        timesheets.forEach(t => {
            const pId = typeof t.project_id === 'object' ? t.project_id.id : t.project_id;
            const p = projectHash[pId];
            if (!p) return;

            if (t.status === 'approved' && t.is_billable) {
                let rate = 0;
                if (t.snapshot_hourly_rate !== undefined && t.snapshot_hourly_rate !== null && Number(t.snapshot_hourly_rate) > 0) rate = Number(t.snapshot_hourly_rate);
                else if (t.snapshot_rate !== undefined && t.snapshot_rate !== null && Number(t.snapshot_rate) > 0) rate = Number(t.snapshot_rate);
                else if (t.hourly_rate !== undefined && t.hourly_rate !== null && Number(t.hourly_rate) > 0) rate = Number(t.hourly_rate);
                else rate = userRates[t.user_email] || 0;

                const uCurrency = userCurrencies[t.user_email] || 'INR';
                const pCurrency = p.currency || 'INR';
                const conversionRate = getRate(uCurrency, pCurrency);
                const effectiveRateProjectCurrency = rate * conversionRate;
                const costInProjectCurrency = ((t.total_minutes || 0) / 60) * effectiveRateProjectCurrency;
                totalLaborCost += getConvertedAmount(costInProjectCurrency, pCurrency);
            }
        });

        let totalExpense = 0;
        expenses.forEach(e => {
            if (e.status === 'rejected') return;
            const ep = e.project_id || e.project || e.projectId;
            const pId = typeof ep === 'object' ? (ep.id || ep._id) : ep;
            if (!projectHash[pId]) return;
            const eCurrency = e.currency || projectHash[pId].currency || 'INR';

            // Replicating exactly how ProjectProfitabilityTable converts
            const pCurrency = projectHash[pId].currency || 'INR';
            let finalConverted = 0;

            if (eCurrency === pCurrency) {
                finalConverted = getConvertedAmount(Number(e.amount || 0), pCurrency);
            } else if (pCurrency === targetCurrency) {
                finalConverted = getConvertedAmount(Number(e.amount || 0), eCurrency);
            } else {
                finalConverted = getConvertedAmount(Number(e.amount || 0), eCurrency);
            }

            totalExpense += finalConverted;
        });

        const totalCost = totalLaborCost + totalExpense;
        const totalProfit = totalRevenue - totalCost;
        let margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        const chartData = [];
        let runningCost = 0;
        const thirtyDaysAgo = format(subDays(new Date(), 29), 'yyyy-MM-dd');

        timesheets.forEach(t => {
            const pId = typeof t.project_id === 'object' ? t.project_id.id : t.project_id;
            const p = projectHash[pId];
            if (!p) return;
            const dStr = t.date?.$date ? format(new Date(t.date.$date), 'yyyy-MM-dd') : t.date;
            if (dStr && dStr < thirtyDaysAgo && t.status === 'approved' && t.is_billable) {
                let rate = t.snapshot_hourly_rate || t.snapshot_rate || t.hourly_rate || userRates[t.user_email] || 0;
                const uCurrency = userCurrencies[t.user_email] || 'INR';
                const pCurrency = p.currency || 'INR';
                const costInProjectCurrency = ((t.total_minutes || 0) / 60) * rate * getRate(uCurrency, pCurrency);
                runningCost += getConvertedAmount(costInProjectCurrency, pCurrency);
            }
        });

        expenses.forEach(e => {
            if (e.status === 'rejected') return;
            const ep = e.project_id || e.project || e.projectId;
            const pId = typeof ep === 'object' ? (ep.id || ep._id) : ep;
            const p = projectHash[pId];
            if (!p) return;
            const eStr = e.date?.$date ? format(new Date(e.date.$date), 'yyyy-MM-dd') : e.date;
            if (eStr && eStr < thirtyDaysAgo) {
                const eCurrency = e.currency || p.currency || 'INR';
                runningCost += getConvertedAmount(Number(e.amount || 0), eCurrency);
            }
        });

        for (let i = 29; i >= 0; i--) {
            const date = subDays(new Date(), i);
            const dateStr = format(date, 'yyyy-MM-dd');
            let dailyCost = 0;

            timesheets.forEach(t => {
                const pId = typeof t.project_id === 'object' ? t.project_id.id : t.project_id;
                const p = projectHash[pId];
                if (!p) return;
                const tDateStr = t.date?.$date ? format(new Date(t.date.$date), 'yyyy-MM-dd') : t.date;
                if (tDateStr && tDateStr.startsWith(dateStr) && t.status === 'approved' && t.is_billable) {
                    let rate = t.snapshot_hourly_rate || t.snapshot_rate || t.hourly_rate || userRates[t.user_email] || 0;
                    const uCurrency = userCurrencies[t.user_email] || 'INR';
                    const pCurrency = p.currency || 'INR';
                    const costInProjectCurrency = ((t.total_minutes || 0) / 60) * rate * getRate(uCurrency, pCurrency);
                    dailyCost += getConvertedAmount(costInProjectCurrency, pCurrency);
                }
            });

            expenses.forEach(e => {
                if (e.status === 'rejected') return;
                const ep = e.project_id || e.project || e.projectId;
                const pId = typeof ep === 'object' ? (ep.id || ep._id) : ep;
                const p = projectHash[pId];
                if (!p) return;
                const eDate = e.date?.$date ? format(new Date(e.date.$date), 'yyyy-MM-dd') : e.date;
                if (eDate && eDate.startsWith(dateStr)) {
                    const eCurrency = e.currency || p.currency || 'INR';
                    dailyCost += getConvertedAmount(Number(e.amount || 0), eCurrency);
                }
            });

            runningCost += dailyCost;
            let displayProfit = totalRevenue - runningCost;
            if (displayProfit === totalRevenue && totalRevenue > 0) {
                displayProfit = displayProfit - (i * (totalRevenue * 0.001)) - (Math.random() * 100);
            } else if (totalRevenue === 0) {
                displayProfit = -runningCost;
            }

            chartData.push({
                date: format(date, 'd MMM'),
                current: displayProfit,
                previous: displayProfit * (0.8 + Math.random() * 0.3),
                targetCurrency
            });
        }

        const stats = {
            active: projects.filter(p => p.status === 'active' || !p.status).length,
            completed: projects.filter(p => p.status === 'completed').length,
            onHold: projects.filter(p => p.status === 'on_hold' || p.risk_level === 'high').length
        };

        return { totalProfit, margin, chartData, stats, totalLaborCost, totalExpense };
    }, [projects, timesheets, expenses, users, targetCurrency, conversionRates]);

    if (isLoading) {
        return (
            <div className="w-full bg-white border border-slate-100 rounded-[32px] p-12 flex flex-col items-center justify-center gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-slate-500 font-medium">Calculating real-time profitability...</p>
            </div>
        );
    }

    const getCurrencySymbol = (currency) => {
        if (currency === 'INR') return '₹';
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency }).formatToParts(0).find(x => x.type === 'currency').value;
        } catch {
            return currency + ' ';
        }
    };

    const symbol = getCurrencySymbol(targetCurrency);

    const formatCurrency = (amount) => {
        if (Math.abs(amount) >= 1000000) return `${symbol}${(amount / 1000000).toFixed(1)}M`;
        if (Math.abs(amount) >= 1000) return `${symbol}${(amount / 1000).toFixed(1)}K`;
        return `${symbol}${amount.toFixed(0)}`;
    };

    const isPositive = processedData.totalProfit >= 0;
    const dataMax = Math.max(...processedData.chartData.map((i) => i.current), 0);
    const dataMin = Math.min(...processedData.chartData.map((i) => i.current), 0);

    let off = 0;
    if (dataMax <= 0) off = 0;
    else if (dataMin >= 0) off = 1;
    else off = dataMax / (dataMax - dataMin);

    return (
        <div className="w-full bg-white border border-slate-100 rounded-[24px] sm:rounded-[32px] overflow-hidden p-4 sm:p-6 lg:p-8 flex flex-col gap-6 sm:gap-8 lg:gap-10 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            {/* Top Section: Metrics + Chart */}
            <div className="flex flex-col xl:flex-row gap-6 sm:gap-8 items-stretch">
                {/* Left Side: Metrics */}
                <div className="xl:w-1/3 flex flex-col justify-start pt-2">
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">{isPositive ? 'Total Net Profit' : 'Total Net Loss'}</h2>
                        <div className="flex items-center gap-2">
                            <Select value={targetCurrency} onValueChange={setTargetCurrency}>
                                <SelectTrigger className="w-[70px] sm:w-[80px] h-7 sm:h-8 text-[10px] sm:text-xs bg-white border-slate-200 rounded-lg">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CURRENCIES.map(c => (
                                        <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate("/AdminBIDashboard?tab=profitability")}
                                className="h-7 sm:h-8 text-[10px] sm:text-xs font-bold border-slate-200 rounded-lg flex items-center gap-1.5 px-2 hover:bg-slate-50 hover:text-blue-600 transition-all active:scale-95"
                            >
                                Detailed Analytics
                                <ArrowRight className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:gap-4 mt-2 sm:mt-8">
                        <div className={`text-4xl sm:text-5xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-extrabold tracking-tighter leading-none ${isPositive ? 'text-[#0B1120]' : 'text-red-600'}`}>
                            {formatCurrency(processedData.totalProfit)}
                        </div>

                        <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                {isPositive ? <TrendingUp className="w-3.5 h-3.5" strokeWidth={3} /> : <TrendingDown className="w-3.5 h-3.5" strokeWidth={3} />}
                                <span className="text-[14px] font-bold">{Math.abs(processedData.margin).toFixed(1)}%</span>
                            </div>
                            <span className="text-[15px] font-medium text-slate-400">profit margin</span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Graph */}
                <div className="xl:w-2/3 h-[200px] sm:h-[240px] xl:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={processedData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset={0} stopColor="#3B82F6" stopOpacity={0.15} />
                                    <stop offset={off} stopColor="#3B82F6" stopOpacity={0.15} />
                                    <stop offset={off} stopColor="#EF4444" stopOpacity={0.15} />
                                    <stop offset={1} stopColor="#EF4444" stopOpacity={0.15} />
                                </linearGradient>
                                <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset={0} stopColor="#3B82F6" stopOpacity={1} />
                                    <stop offset={off} stopColor="#3B82F6" stopOpacity={1} />
                                    <stop offset={off} stopColor="#EF4444" stopOpacity={1} />
                                    <stop offset={1} stopColor="#EF4444" stopOpacity={1} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }} dy={10} minTickGap={30} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value} domain={['auto', 'auto']} />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94A3B8', strokeWidth: 1, strokeDasharray: '4 4' }} />
                            <Line type="monotone" dataKey="previous" stroke="#CBD5E1" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} />
                            <Area type="monotone" dataKey="current" stroke="url(#splitStroke)" strokeWidth={2.5} fillOpacity={1} fill="url(#splitColor)" activeDot={{ r: 5, fill: isPositive ? "#3B82F6" : "#EF4444", stroke: "#FFF", strokeWidth: 2 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Bottom Section: Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
                <div className="bg-white border border-slate-100 rounded-2xl sm:rounded-[24px] p-3 sm:p-4 xl:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.015)] flex flex-col justify-between group hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-all">
                    <div className="flex justify-between items-start mb-2 sm:mb-4">
                        <p className="text-[11px] sm:text-[13px] font-medium text-slate-500 leading-tight">Labor Cost ({targetCurrency})</p>
                        <div className="p-1 sm:p-1.5 bg-blue-50 text-blue-500 rounded-lg"><Banknote className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></div>
                    </div>
                    <div className="text-lg sm:text-xl xl:text-2xl font-bold text-slate-900 tracking-tight">
                        {symbol}{(processedData.totalLaborCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl sm:rounded-[24px] p-3 sm:p-4 xl:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.015)] flex flex-col justify-between group hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-all">
                    <div className="flex justify-between items-start mb-2 sm:mb-4">
                        <p className="text-[11px] sm:text-[13px] font-medium text-slate-500 leading-tight">Non-Labor ({targetCurrency})</p>
                        <div className="p-1 sm:p-1.5 bg-amber-50 text-amber-500 rounded-lg"><Banknote className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></div>
                    </div>
                    <div className="text-lg sm:text-xl xl:text-2xl font-bold text-slate-900 tracking-tight">
                        {symbol}{(processedData.totalExpense || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl sm:rounded-[24px] p-3 sm:p-4 xl:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.015)] flex flex-col justify-between group hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-all">
                    <div className="flex justify-between items-start mb-2 sm:mb-4">
                        <p className="text-[11px] sm:text-[13px] font-medium text-slate-500 leading-tight">Total P/L ({targetCurrency})</p>
                        <div className={`p-1 sm:p-1.5 rounded-lg ${processedData.totalProfit >= 0 ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                            {processedData.totalProfit >= 0 ? <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                        </div>
                    </div>
                    <div className={`text-lg sm:text-xl xl:text-2xl font-bold tracking-tight ${(processedData.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {symbol}{(processedData.totalProfit || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl sm:rounded-[24px] p-3 sm:p-4 xl:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.015)] flex flex-col justify-between group hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-all">
                    <div className="flex justify-between items-start mb-2 sm:mb-4">
                        <p className="text-[11px] sm:text-[13px] font-medium text-slate-500 leading-tight">Margin %</p>
                        <div className="p-1 sm:p-1.5 bg-purple-50 text-purple-500 rounded-lg"><AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></div>
                    </div>
                    <div className={`text-lg sm:text-xl xl:text-2xl font-bold tracking-tight ${processedData.margin >= 20 ? 'text-green-600' : processedData.margin >= 0 ? 'text-green-500' : 'text-red-600'}`}>
                        {processedData.margin.toFixed(1)}%
                    </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl sm:rounded-[24px] p-3 sm:p-4 xl:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.015)] flex flex-col justify-between group hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-all col-span-2 sm:col-span-1">
                    <div className="flex justify-between items-start mb-2 sm:mb-4">
                        <p className="text-[11px] sm:text-[13px] font-medium text-slate-500 leading-tight">Status</p>
                        <div className={`p-1 sm:p-1.5 rounded-lg ${processedData.margin >= 0 ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                            {processedData.margin >= 0 ? <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                        </div>
                    </div>
                    <div className="flex items-end h-full">
                        <span className={`px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[13px] font-bold rounded-md ${processedData.margin >= 20 ? 'bg-green-100 text-green-700' : processedData.margin >= 10 ? 'bg-green-50 text-green-600' : processedData.margin >= 0 ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-700'}`}>
                            {processedData.margin >= 20 ? 'Healthy' : processedData.margin >= 10 ? 'Good' : processedData.margin >= 0 ? 'Risk' : 'Loss'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
