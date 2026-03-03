// src/pages/PaymentGateways.jsx
import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useUser } from "@/components/shared/UserContext";
import { Loader2, ArrowLeft, ShieldAlert, CreditCard, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SubscriptionHistoryTable from "@/components/subscriptions/SubscriptionHistoryTable";

export default function PaymentGateways() {
    const { user, isLoading: isUserLoading } = useUser();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [razorpayKeyId, setRazorpayKeyId] = useState("");
    const [razorpayKeySecret, setRazorpayKeySecret] = useState("");

    const { data: config, isLoading: isConfigLoading } = useQuery({
        queryKey: ['admin-razorpay-config'],
        queryFn: async () => {
            // Will implement the actual fetch method in groonabackend.js next
            return await groonabackend.custom.getRazorpayConfig();
        },
        enabled: !!user?.is_super_admin,
    });

    useEffect(() => {
        if (config) {
            setRazorpayKeyId(config.RAZORPAY_KEY_ID || "");
            setRazorpayKeySecret(config.RAZORPAY_KEY_SECRET || "");
        }
    }, [config]);

    const { data: subscriptions = [], isLoading: isSubLoading } = useQuery({
        queryKey: ['admin-payment-history'],
        queryFn: async () => await groonabackend.payments.getAdminHistory(),
        enabled: !!user?.is_super_admin,
    });

    const updateMutation = useMutation({
        mutationFn: async (data) => {
            return await groonabackend.custom.updateRazorpayConfig(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-razorpay-config'] });
            toast.success("Payment Gateway Keys Updated Successfully!");
        },
        onError: (error) => {
            toast.error("Failed to update keys", { description: error.message || "Unknown error occurred" });
        }
    });

    const handleSave = (e) => {
        e.preventDefault();
        if (!razorpayKeyId || !razorpayKeySecret) {
            toast.error("Both Key ID and Secret are required to save.");
            return;
        }
        updateMutation.mutate({
            RAZORPAY_KEY_ID: razorpayKeyId,
            RAZORPAY_KEY_SECRET: razorpayKeySecret
        });
    };

    if (isUserLoading || isConfigLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (!user?.is_super_admin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="bg-red-50 p-4 rounded-full mb-4">
                    <ShieldAlert className="w-12 h-12 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
                <p className="text-slate-600 max-w-md mb-8">
                    This area is restricted to Super Administrators only. You do not have permission to view or modify payment gateway credentials.
                </p>
                <Button onClick={() => navigate('/Dashboard')}>Return to Dashboard</Button>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto relative">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/SuperAdminDashboard')}
                className="absolute left-4 top-4 md:left-8 md:top-8 text-slate-500 hover:text-slate-900"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
            </Button>

            <div className="pt-12 text-center md:text-left">
                <h1 className="text-3xl font-bold text-slate-900 flex items-center justify-center md:justify-start gap-3">
                    <CreditCard className="h-8 w-8 text-indigo-600" />
                    Payment Gateways
                </h1>
                <p className="text-slate-600 mt-2">
                    Manage your global payment provider credentials. These keys will be saved securely to the backend environment file.
                </p>
            </div>

            <div className="grid gap-6">
                <Card className="border-indigo-100 shadow-sm overflow-hidden">
                    <div className="bg-indigo-50/50 border-b border-indigo-100 p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {/* A generic payment icon since we don't have a razorpay specific one */}
                                <div className="bg-white p-2 rounded shadow-sm border border-indigo-100 text-indigo-700 font-bold text-sm tracking-widest uppercase">
                                    Razorpay
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">Razorpay Integration</h3>
                                    <p className="text-xs text-slate-500">Live API Credentials for Subscriptions</p>
                                </div>
                            </div>
                            <div className="px-3 py-1 bg-green-100 text-green-700 border border-green-200 rounded-full text-xs font-medium flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                Active System
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSave}>
                        <CardContent className="p-6 space-y-6">

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="keyId" className="text-slate-700 font-medium">Razorpay Key ID</Label>
                                    <Input
                                        id="keyId"
                                        type="text"
                                        placeholder="rzp_live_xxxxxxxxxxxxxx"
                                        className="font-mono bg-slate-50"
                                        value={razorpayKeyId}
                                        onChange={(e) => setRazorpayKeyId(e.target.value)}
                                    />
                                    <p className="text-xs text-slate-500">The public API Key ID provided by Razorpay.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="keySecret" className="text-slate-700 font-medium">Razorpay Key Secret</Label>
                                    <Input
                                        id="keySecret"
                                        type="password"
                                        placeholder="••••••••••••••••••••••••"
                                        className="font-mono bg-slate-50"
                                        value={razorpayKeySecret}
                                        onChange={(e) => setRazorpayKeySecret(e.target.value)}
                                    />
                                    <p className="text-xs text-slate-500">The private API Secret provided by Razorpay. Keep this secure.</p>
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-md p-4 flex items-start gap-3">
                                <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-amber-800 leading-relaxed">
                                    <strong className="block mb-1">Security Notice</strong>
                                    Saving these credentials will immediately overwrite the .env variables on your backend server. The server will automatically use these new keys for all future subscription checkout sessions.
                                </div>
                            </div>

                        </CardContent>
                        <CardFooter className="bg-slate-50 border-t px-6 py-4 flex justify-end">
                            <Button
                                type="submit"
                                disabled={updateMutation.isPending || (!razorpayKeyId && !razorpayKeySecret)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]"
                            >
                                {updateMutation.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Save Configuration
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>

                {/* Subscription History Data Table */}
                <Card className="border-indigo-100 shadow-sm overflow-hidden mt-8">
                    <CardHeader className="bg-white border-b border-slate-100 pb-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl font-bold text-slate-900">Subscription History</CardTitle>
                                <CardDescription>View all tenant subscription purchases and statuses.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 pt-0">
                        <SubscriptionHistoryTable
                            subscriptions={subscriptions}
                            isLoading={isSubLoading}
                            isSuperAdmin={true}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
