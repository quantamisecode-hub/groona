import React from "react";
import { useQuery } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard } from "lucide-react";
import SubscriptionHistoryTable from "@/components/subscriptions/SubscriptionHistoryTable";
import { useUser } from "@/components/shared/UserContext";

export default function PaymentsHistory() {
    const navigate = useNavigate();
    const { user } = useUser();

    // Fetch individual payment transactions for the current tenant
    const { data: subscriptions = [], isLoading } = useQuery({
        queryKey: ['tenant-payment-history', user?.tenant_id],
        queryFn: async () => {
            if (!user?.tenant_id) return [];
            return await groonabackend.payments.getTenantHistory(user.tenant_id);
        },
        enabled: !!user?.tenant_id,
    });

    return (
        <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto relative">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/Dashboard')}
                className="absolute left-4 top-4 md:left-8 md:top-8 text-slate-500 hover:text-slate-900"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
            </Button>

            <div className="pt-12 text-center md:text-left mb-8">
                <h1 className="text-3xl font-bold text-slate-900 flex items-center justify-center md:justify-start gap-3">
                    <CreditCard className="h-8 w-8 text-indigo-600" />
                    Payments History
                </h1>
                <p className="text-slate-600 mt-2">
                    Review your past subscription purchases, active plans, and billing history.
                </p>
            </div>

            <Card className="border-indigo-100 shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b border-slate-100 pb-4">
                    <CardTitle className="text-xl font-bold text-slate-900">Billing Records</CardTitle>
                    <CardDescription>Your complete subscription action log.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0 mt-6">
                    <SubscriptionHistoryTable
                        subscriptions={subscriptions}
                        isLoading={isLoading}
                        isSuperAdmin={false}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
