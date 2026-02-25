import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";

export default function SubscriptionBanner({ tenant, onRenew }) {
  if (!tenant) return null;

  const status = tenant.subscription_status;
  const isTrial = status === 'trialing' || tenant.subscription_plan?.includes('trial');
  const trialEnd = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const subscriptionEnd = tenant.subscription_ends_at ? new Date(tenant.subscription_ends_at) : null;
  const gracePeriodEnd = tenant.grace_period_ends_at ? new Date(tenant.grace_period_ends_at) : null;
  const now = new Date();

  // Calculate days remaining
  const effectiveEnd = isTrial ? trialEnd : subscriptionEnd;
  const daysRemaining = effectiveEnd ? Math.ceil((effectiveEnd - now) / (1000 * 60 * 60 * 24)) : null;

  // Show banner for pre-expiry (30 days), expired, restricted, or suspended
  const showBanner = 
    (daysRemaining !== null && daysRemaining <= 30 && daysRemaining > 0) ||
    status === 'expired' ||
    status === 'restricted' ||
    status === 'suspended';

  if (!showBanner) return null;

  // Suspended - Critical
  if (status === 'suspended') {
    return (
      <Alert variant="destructive" className="mb-6 border-red-500">
        <XCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <strong className="font-bold">Account Suspended</strong>
            <p className="text-sm mt-1">
              Your account has been suspended due to subscription expiry. All access is blocked.
            </p>
          </div>
          <Button onClick={onRenew} variant="destructive" className="ml-4">
            Renew Now
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Restricted/Expired - Warning
  if (status === 'restricted' || status === 'expired') {
    const graceDays = gracePeriodEnd ? Math.ceil((gracePeriodEnd - now) / (1000 * 60 * 60 * 24)) : 0;
    return (
      <Alert variant="destructive" className="mb-6 border-orange-500 bg-orange-50">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="flex items-center justify-between text-orange-900">
          <div>
            <strong className="font-bold">Subscription Expired - Limited Access</strong>
            <p className="text-sm mt-1">
              You're in restricted mode with read-only access. 
              {graceDays > 0 && ` You have ${graceDays} days before suspension.`}
            </p>
          </div>
          <Button onClick={onRenew} className="ml-4 bg-orange-600 hover:bg-orange-700">
            Renew Now
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Pre-expiry warning
  if (daysRemaining !== null && daysRemaining <= 30 && daysRemaining > 0) {
    const isUrgent = daysRemaining <= 7;
    return (
      <Alert 
        variant={isUrgent ? "destructive" : "default"}
        className={`mb-6 ${isUrgent ? 'border-red-500 bg-red-50' : 'border-amber-500 bg-amber-50'}`}
      >
        <Clock className={`h-4 w-4 ${isUrgent ? 'text-red-600' : 'text-amber-600'}`} />
        <AlertDescription className={`flex items-center justify-between ${isUrgent ? 'text-red-900' : 'text-amber-900'}`}>
          <div>
            <strong className="font-bold">
              {isTrial ? 'Trial ' : 'Subscription '}Expiring Soon
            </strong>
            <p className="text-sm mt-1">
              Your {isTrial ? 'trial' : 'subscription'} expires in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} 
              {effectiveEnd && ` on ${format(effectiveEnd, 'MMM d, yyyy')}`}.
            </p>
          </div>
          <Button 
            onClick={onRenew} 
            className={isUrgent ? 'ml-4 bg-red-600 hover:bg-red-700' : 'ml-4 bg-amber-600 hover:bg-amber-700'}
          >
            {isTrial ? 'Upgrade Now' : 'Renew Now'}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}