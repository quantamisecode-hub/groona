import React from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '@/components/shared/UserContext';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LogOut, CreditCard, Sparkles } from 'lucide-react';
import { groonabackend } from '@/api/groonabackend';

export default function TenantGuard({ children }) {
    const { user, tenant, subscription, isLoading } = useUser();
    const location = useLocation();

    // Check if user is owner
    const isOwner = user?.role === 'admin' && user?.custom_role === 'owner';

    // If loading, just render children (or nothing), 
    // auth guard usually handles unauthenticated state.
    if (isLoading) {
        return <>{children}</>;
    }

    // Super Admins are exempt from all checks
    if (user?.is_super_admin) {
        return <>{children}</>;
    }

    // Routes allowed even when suspended (to allow upgrading)
    const allowedRoutes = [
        '/SubscriptionManagement',
        '/subscription-management',
        '/AISubscriptionManagement',
        '/SupportDashboard'
    ];

    const isAllowedRoute = allowedRoutes.some(route =>
        location.pathname.toLowerCase().includes(route.toLowerCase())
    );

    // Check for suspended status using authoritative TenantSubscription data
    let isSuspended = false;

    if (subscription) {
        // 1. Direct Status Check from Subscription Table
        const severeStatuses = ['past_due', 'canceled', 'suspended', 'unpaid'];
        if (severeStatuses.includes(subscription.status)) {
            isSuspended = true;
        }

        // 2. Trial Expiration Check (even if status is still technically 'trialing')
        // Check if plan implies trial or status is trialing
        const isTrial =
            subscription.status === 'trialing' ||
            subscription.plan_name?.toLowerCase().includes('trial') ||
            subscription.subscription_type === 'trial';

        if (isTrial && subscription.trial_ends_at) {
            const trialEnd = new Date(subscription.trial_ends_at);
            if (new Date() > trialEnd) {
                isSuspended = true;
            }
        }
    } else if (tenant) {
        // Fallback to Tenant object if subscription record missing (legacy/edge case)
        if (tenant.status === 'suspended') isSuspended = true;

        const isTrial = tenant.subscription_status === 'trialing' || tenant.subscription_plan?.toLowerCase().includes('trial');
        if (isTrial && tenant.trial_ends_at) {
            const trialEnd = new Date(tenant.trial_ends_at);
            if (new Date() > trialEnd) {
                isSuspended = true;
            }
        }
    }

    // Override if allowed route
    if (isAllowedRoute) {
        isSuspended = false;
    }

    if (isSuspended) {
        return (
            <div className="relative w-full h-full min-h-screen">
                {/* Background Content - Disabled interaction */}
                <div className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-100 filter blur-[1px]" aria-hidden="true">
                    {children}
                </div>

                {/* Dark Curtain Overlay */}
                <div className="fixed inset-0 bg-black/10 z-[100000] backdrop-blur-[1px] transition-all duration-300" />

                {/* Blocking Overlay */}
                <AlertDialog open={true}>
                    <AlertDialogContent
                        className="max-w-md w-full z-[100001] border-red-100 shadow-2xl bg-white/95 backdrop-blur-xl"
                        overlayClassName="bg-transparent"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        onEscapeKeyDown={(e) => e.preventDefault()}
                        onPointerDownOutside={(e) => e.preventDefault()}
                    >
                        <AlertDialogHeader className="space-y-3 pb-4 border-b border-gray-100">
                            <div className="mx-auto bg-red-50 p-3 rounded-full w-14 h-14 flex items-center justify-center mb-2">
                                <CreditCard className="h-7 w-7 text-red-600" />
                            </div>
                            <AlertDialogTitle className="text-2xl font-bold text-center text-slate-800">
                                Subscription Expired
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-center pt-2 pb-2 text-slate-600">
                                {isOwner
                                    ? "To restore full access and continue using Groona, please upgrade your subscription plan."
                                    : "Your workspace subscription has expired. Please contact your workspace owner to restore access."
                                }
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        <AlertDialogFooter className="flex-col gap-3 mt-4 pt-2">
                            {isOwner && (
                                <Button
                                    onClick={() => window.location.href = '/SubscriptionManagement'}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-md transition-all duration-200"
                                    size="lg"
                                >
                                    <Sparkles className="w-5 h-5 mr-2" />
                                    Upgrade Plan
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                onClick={() => {
                                    groonabackend.auth.logout();
                                    window.location.href = '/SignIn';
                                }}
                                className="w-full border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                Sign Out
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        );
    }

    return <>{children}</>;
}
