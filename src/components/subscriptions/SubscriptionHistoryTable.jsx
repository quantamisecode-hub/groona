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
import { Loader2, Search, Filter, ArrowUpDown } from "lucide-react";

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

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by plan, ID or tenant..."
                            className="pl-9 w-[200px] lg:w-[300px]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-slate-500" />
                        <select
                            className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Statuses</option>
                            <option value="captured">Captured</option>
                            <option value="active">Active</option>
                            <option value="trialing">Trialing</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
            ) : filteredSubscriptions.length === 0 ? (
                <div className="text-center py-12 text-slate-500 border rounded-md bg-slate-50">
                    No payment records found matching your filters.
                </div>
            ) : (
                <div className="overflow-x-auto rounded-md border border-slate-200">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead>Payment ID</TableHead>
                                {isSuperAdmin && (
                                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('tenant_name')}>
                                        <div className="flex items-center gap-1">Tenant <ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                )}
                                <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('plan_name')}>
                                    <div className="flex items-center gap-1">Plan <ArrowUpDown className="h-3 w-3" /></div>
                                </TableHead>
                                <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('amount')}>
                                    <div className="flex items-center gap-1">Amount <ArrowUpDown className="h-3 w-3" /></div>
                                </TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('payment_date')}>
                                    <div className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></div>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSubscriptions.map((sub) => (
                                <TableRow key={sub.id || sub._id}>
                                    <TableCell className="font-mono text-[10px] text-slate-500">
                                        {sub.razorpay_payment_id || <span className="text-slate-300">N/A (Trial)</span>}
                                    </TableCell>
                                    {isSuperAdmin && (
                                        <TableCell>
                                            <div className="font-medium text-slate-900">{sub.tenant_name}</div>
                                            <div className="text-xs text-slate-500 truncate max-w-[150px]">{sub.contact_email}</div>
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        <div className="font-medium text-slate-900">{sub.plan_name}</div>
                                        {sub.billing_cycle && (
                                            <div className="text-[10px] text-slate-500 uppercase">{sub.billing_cycle}</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {new Intl.NumberFormat('en-US', {
                                            style: 'currency',
                                            currency: sub.currency || 'USD',
                                            minimumFractionDigits: 0
                                        }).format(sub.amount || sub.monthly_price || 0)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={
                                            (sub.payment_status === 'active' || sub.payment_status === 'captured') ? 'border-green-200 text-green-700 bg-green-50' :
                                                sub.payment_status === 'trialing' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                                                    sub.payment_status === 'cancelled' ? 'border-red-200 text-red-700 bg-red-50' :
                                                        'bg-slate-100 text-slate-700'
                                        }>
                                            {sub.payment_status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-slate-600 text-sm">
                                        {new Date(sub.payment_date || sub.created_date).toLocaleDateString(undefined, {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
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
