import React from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Calendar, TrendingUp, TrendingDown } from "lucide-react";

export default function LeaveBalances({ currentUser, tenantId }) {
  const currentYear = new Date().getFullYear();

  // Fetch leave balances
  const { data: balances = [], isLoading } = useQuery({
    queryKey: ['leave-balances', currentUser?.id, tenantId, currentYear],
    queryFn: () => groonabackend.entities.LeaveBalance.filter({
      tenant_id: tenantId,
      user_id: currentUser.id,
      year: currentYear
    }),
    enabled: !!currentUser && !!tenantId,
  });

  if (isLoading) {
    return (
      <Card className="p-12 text-center">
        <p className="text-slate-600">Loading balances...</p>
      </Card>
    );
  }

  if (balances.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Calendar className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-600">No leave balances configured</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {balances.map((balance) => {
        const usedPercentage = balance.allocated > 0 ? (balance.used / balance.allocated) * 100 : 0;
        
        return (
          <Card key={balance.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{balance.leave_type_name}</span>
                <Calendar className="h-5 w-5 text-slate-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-slate-900">{balance.allocated}</p>
                  <p className="text-xs text-slate-500">Allocated</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{balance.used}</p>
                  <p className="text-xs text-slate-500">Used</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{balance.remaining}</p>
                  <p className="text-xs text-slate-500">Remaining</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <Progress value={usedPercentage} className="h-2" />
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{usedPercentage.toFixed(0)}% Used</span>
                  {balance.pending > 0 && (
                    <span className="text-yellow-600">
                      {balance.pending} Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-center gap-2 text-sm">
                {balance.remaining > balance.allocated * 0.5 ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">Healthy Balance</span>
                  </>
                ) : balance.remaining > 0 ? (
                  <>
                    <TrendingDown className="h-4 w-4 text-yellow-600" />
                    <span className="text-yellow-600">Low Balance</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <span className="text-red-600">Exhausted</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

