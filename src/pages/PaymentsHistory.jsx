import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, Download, Receipt, Sparkles, TrendingUp, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import SubscriptionHistoryTable from "@/components/subscriptions/SubscriptionHistoryTable";
import { useUser } from "@/components/shared/UserContext";
import { cn } from "@/lib/utils";

export default function PaymentsHistory() {
    const navigate = useNavigate();
    const { user } = useUser();
    const [cursor, setCursor] = React.useState(null);
    const [cursorHistory, setCursorHistory] = React.useState([]);
    const itemsPerPage = 10;

    // Fetch individual payment transactions with cursor-based pagination
    const {
        data: paginatedResponse,
        isLoading,
        isFetching
    } = useQuery({
        queryKey: ['tenant-payment-history', user?.tenant_id, cursor],
        queryFn: async () => {
            if (!user?.tenant_id) return { results: [], totalCount: 0 };
            return await groonabackend.payments.getTenantHistory(user.tenant_id, cursor, itemsPerPage);
        },
        enabled: !!user?.tenant_id,
    });

    const subscriptions = paginatedResponse?.results || [];
    const totalCount = paginatedResponse?.totalCount || 0;
    const nextCursor = paginatedResponse?.nextCursor;

    const handleNextPage = () => {
        if (nextCursor) {
            setCursorHistory(prev => [...prev, cursor]);
            setCursor(nextCursor);
        }
    };

    const handlePrevPage = () => {
        if (cursorHistory.length > 0) {
            const newHistory = [...cursorHistory];
            const prevCursor = newHistory.pop();
            setCursorHistory(newHistory);
            setCursor(prevCursor);
        }
    };

    // Derived Stats for premium look
    const stats = useMemo(() => {
        if (!subscriptions.length) return { totalSpent: 0, activePlan: 'None', lastPayment: 'N/A' };

        const total = subscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0);
        const active = subscriptions.find(s => s.payment_status === 'active' || s.payment_status === 'captured')?.plan_name || 'Free';
        const latest = subscriptions[0] ? new Date(subscriptions[0].payment_date || subscriptions[0].created_date).toLocaleDateString() : 'N/A';

        return {
            totalSpent: total,
            activePlan: active,
            lastPayment: latest
        };
    }, [subscriptions]);

    return (
        <div className="min-h-screen bg-[#FBFBFC] selection:bg-blue-100 selection:text-blue-900">
            {/* Top Navigation Bar - More Slim */}
            <div className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-slate-100 py-3">
                <div className="w-full px-6 md:px-12 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/Dashboard')}
                            className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-500 transition-all duration-300"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <div className="h-4 w-px bg-slate-200" />
                        <h2 className="text-[14px] font-semibold text-slate-900">Billing</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 px-3 rounded-full border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50">
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            Report
                        </Button>
                    </div>
                </div>
            </div>

            <div className="w-full px-6 md:px-12 py-8 md:py-10 space-y-8">
                {/* Hero Header Section - Tighter */}
                <header className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider mb-1">
                        <Sparkles className="w-3 h-3" />
                        Finance
                    </div>
                    <h1 className="text-3xl md:text-3xl font-extrabold text-[#1D1D1F] tracking-tight leading-none">
                        Payments History
                    </h1>
                    <p className="text-[15px] text-slate-500 font-medium leading-normal max-w-xl">
                        Manage your billing and transaction records.
                    </p>
                </header>

                {/* Quick Stats Grid - Very Minimal */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-white border-none shadow-[0_1px_4px_rgba(0,0,0,0.02)] rounded-2xl overflow-hidden group hover:shadow-md transition-all duration-500">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform shrink-0">
                                    <CreditCard className="w-4.5 h-4.5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Active Plan</p>
                                    <h3 className="text-[17px] font-black text-slate-900 leading-none">{stats.activePlan}</h3>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-none shadow-[0_1px_4px_rgba(0,0,0,0.02)] rounded-2xl overflow-hidden group hover:shadow-md transition-all duration-500">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform shrink-0">
                                    <TrendingUp className="w-4.5 h-4.5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Lifetime Spent</p>
                                    <h3 className="text-[17px] font-black text-slate-900 leading-none">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(stats.totalSpent)}
                                    </h3>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-none shadow-[0_1px_4px_rgba(0,0,0,0.02)] rounded-2xl overflow-hidden group hover:shadow-md transition-all duration-500">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform shrink-0">
                                    <Receipt className="w-4.5 h-4.5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Last Transaction</p>
                                    <h3 className="text-[17px] font-black text-slate-900 leading-none">{stats.lastPayment}</h3>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Table Content - Tighten Card */}
                <div className="space-y-4">
                    <div className="px-1 flex items-center justify-between">
                        <h3 className="text-[16px] font-bold text-[#1D1D1F] tracking-tight">Billing History</h3>
                    </div>

                    <Card className="bg-white border-none shadow-[0_1px_10px_rgba(0,0,0,0.02)] rounded-2xl overflow-hidden border border-slate-100/50">
                        <CardContent className="p-0">
                            <SubscriptionHistoryTable
                                subscriptions={subscriptions}
                                isLoading={isLoading}
                                isSuperAdmin={false}
                            />

                            {/* Pagination Footer */}
                            {(nextCursor || cursorHistory.length > 0) && (
                                <div className="p-4 border-t border-slate-50 bg-slate-50/10 flex items-center justify-between px-6">
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handlePrevPage}
                                            disabled={cursorHistory.length === 0 || isFetching}
                                            className="h-8 w-8 p-0 rounded-lg hover:bg-white text-slate-600 transition-all disabled:opacity-30"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>

                                        <div className="flex items-center gap-1 mx-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="h-8 min-w-[32px] px-2 p-0 text-[11px] font-black rounded-lg bg-white shadow-sm text-blue-600 ring-1 ring-slate-100"
                                            >
                                                PAGE {cursorHistory.length + 1}
                                            </Button>
                                            {nextCursor && (
                                                <span className="text-[10px] font-black text-slate-300 px-1 uppercase tracking-widest">
                                                    NEXT •••
                                                </span>
                                            )}
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleNextPage}
                                            disabled={!nextCursor || isFetching}
                                            className="h-8 w-8 p-0 rounded-lg hover:bg-white text-slate-600 transition-all disabled:opacity-30"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                                        <span>Showing Page {cursorHistory.length + 1} • {totalCount} Records Total</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <footer className="pt-6 border-t border-slate-100">
                    <p className="text-slate-400 text-xs font-medium text-center md:text-left">
                        Need help? <button className="text-blue-600 hover:underline font-bold transition-colors">Contact Support</button>
                    </p>
                </footer>
            </div>
        </div>
    );
}
