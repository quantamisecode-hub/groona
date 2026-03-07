import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Filter, ArrowUpDown, ChevronRight, FileText, ExternalLink, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SubscriptionHistoryTable({ subscriptions = [], isLoading = false, isSuperAdmin = false }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortConfig, setSortConfig] = useState({ key: 'created_date', direction: 'desc' });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedSubscriptions = React.useMemo(() => {
        let sortableItems = [...subscriptions];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key] || (sortConfig.key === 'amount' ? a.monthly_price : null);
                let bValue = b[sortConfig.key] || (sortConfig.key === 'amount' ? b.monthly_price : null);

                if (sortConfig.key === 'tenant_name') { aValue = a.tenant_name?.toLowerCase(); bValue = b.tenant_name?.toLowerCase(); }
                if (sortConfig.key === 'plan_name') { aValue = a.plan_name?.toLowerCase(); bValue = b.plan_name?.toLowerCase(); }
                if (sortConfig.key === 'payment_date' || sortConfig.key === 'created_date') {
                    aValue = new Date(a.payment_date || a.created_date).getTime();
                    bValue = new Date(b.payment_date || b.created_date).getTime();
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [subscriptions, sortConfig]);

    const filteredSubscriptions = sortedSubscriptions.filter(sub => {
        const matchesSearch =
            (sub.tenant_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (sub.plan_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (sub.razorpay_payment_id || "").toLowerCase().includes(searchTerm.toLowerCase());
        const status = (sub.payment_status || "").toLowerCase();
        const matchesStatus = statusFilter === "all" || status === statusFilter.toLowerCase();
        return matchesSearch && matchesStatus;
    });

    const getStatusStyles = (status) => {
        switch (status?.toLowerCase()) {
            case 'active':
            case 'captured':
                return "bg-emerald-50 text-emerald-600 border-emerald-100/50";
            case 'trialing':
                return "bg-amber-50 text-amber-600 border-amber-100/50";
            case 'cancelled':
                return "bg-rose-50 text-rose-600 border-rose-100/50";
            default:
                return "bg-slate-50 text-slate-600 border-slate-100/50";
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Table Control Header - Slimmer */}
            <div className="px-6 py-4 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-sm">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative group w-full md:w-[280px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                        <Input
                            placeholder="Search..."
                            className="h-9 pl-9 pr-3 bg-slate-50/50 border-none rounded-xl text-[13px] font-medium focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 bg-slate-50/50 p-0.5 rounded-lg border border-slate-100">
                        {['all', 'captured', 'active', 'cancelled'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-tight transition-all",
                                    statusFilter === status
                                        ? "bg-white text-blue-600 shadow-sm"
                                        : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col justify-center items-center py-16 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Loading...</p>
                </div>
            ) : filteredSubscriptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-3">
                    <div className="h-14 w-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-200">
                        <FileText className="w-7 h-7" />
                    </div>
                    <div className="max-w-xs space-y-0.5">
                        <h3 className="text-[15px] font-bold text-slate-900">No records found</h3>
                        <p className="text-xs text-slate-500 font-medium">Try adjusting your search or filters.</p>
                    </div>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-none hover:bg-transparent">
                                <TableHead className="h-10 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</TableHead>
                                {isSuperAdmin && (
                                    <TableHead className="h-10 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('tenant_name')}>
                                        <div className="flex items-center gap-1">Tenant <ArrowUpDown className="h-2.5 w-2.5" /></div>
                                    </TableHead>
                                )}
                                <TableHead className="h-10 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('plan_name')}>
                                    <div className="flex items-center gap-1">Plan <ArrowUpDown className="h-2.5 w-2.5" /></div>
                                </TableHead>
                                <TableHead className="h-10 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('amount')}>
                                    <div className="flex items-center gap-1">Amount <ArrowUpDown className="h-2.5 w-2.5" /></div>
                                </TableHead>
                                <TableHead className="h-10 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</TableHead>
                                <TableHead className="h-10 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('payment_date')}>
                                    <div className="flex items-center justify-end gap-1">Date <ArrowUpDown className="h-2.5 w-2.5" /></div>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSubscriptions.map((sub) => (
                                <TableRow key={sub.id || sub._id} className="border-b border-slate-50/50 transition-all duration-200">
                                    <TableCell className="px-6 py-3.5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 transition-colors">
                                                <Receipt className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="font-mono text-[11px] font-medium text-slate-400 truncate max-w-[80px]">
                                                {sub.razorpay_payment_id || "Trial"}
                                            </span>
                                        </div>
                                    </TableCell>
                                    {isSuperAdmin && (
                                        <TableCell className="px-6 py-3.5">
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-bold text-slate-900 leading-tight">{sub.tenant_name}</span>
                                            </div>
                                        </TableCell>
                                    )}
                                    <TableCell className="px-6 py-3.5">
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-bold text-slate-900 leading-tight">{sub.plan_name}</span>
                                            <span className="text-[9px] font-black text-slate-400 uppercase mt-0.5">{sub.billing_cycle || 'Trial'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-3.5">
                                        <div className="text-[14px] font-black text-slate-900">
                                            {new Intl.NumberFormat('en-US', {
                                                style: 'currency',
                                                currency: sub.currency || 'USD',
                                                minimumFractionDigits: 0
                                            }).format(sub.amount || sub.monthly_price || 0)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-3.5">
                                        <Badge className={cn(
                                            "rounded-full px-2 py-0.5 border text-[9px] font-black uppercase tracking-tight shadow-none",
                                            getStatusStyles(sub.payment_status)
                                        )}>
                                            {sub.payment_status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-6 py-3.5 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[13px] font-bold text-slate-700">
                                                {new Date(sub.payment_date || sub.created_date).toLocaleDateString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
