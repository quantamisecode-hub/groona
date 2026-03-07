import React from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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
          <Card key={balance.id} className="bg-white border-none shadow-sm hover:shadow-md transition-all rounded-[16px] overflow-hidden group">
            <CardHeader className="pb-6 px-6 pt-6 border-b border-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-black text-slate-800 tracking-tight">{balance.leave_type_name}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Calendar Year {currentYear}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-slate-900 transition-colors">
                  <Calendar className="h-5 w-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 px-6 pb-6 pt-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50/50 rounded-[12px] p-3 text-center border border-slate-100/50">
                  <p className="text-[22px] font-black text-slate-900 leading-none mb-1 tracking-tighter">{balance.allocated}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cap</p>
                </div>
                <div className="bg-red-50/30 rounded-[12px] p-3 text-center border border-red-100/30">
                  <p className="text-[22px] font-black text-red-600 leading-none mb-1 tracking-tighter">{balance.used}</p>
                  <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Used</p>
                </div>
                <div className="bg-emerald-50/30 rounded-[12px] p-3 text-center border border-emerald-100/30">
                  <p className="text-[22px] font-black text-emerald-600 leading-none mb-1 tracking-tighter">{balance.remaining}</p>
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Free</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Utilization</span>
                  <span className="text-slate-900">{usedPercentage.toFixed(0)}%</span>
                </div>
                <Progress
                  value={usedPercentage}
                  className="h-2 bg-slate-100 rounded-full overflow-hidden"
                  indicatorClassName={cn(
                    "transition-all duration-700",
                    usedPercentage > 85 ? "bg-red-500" : usedPercentage > 50 ? "bg-amber-500" : "bg-slate-900"
                  )}
                />
                {balance.pending > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50/50 px-2 py-1 rounded-[6px] border border-amber-100/50 w-max">
                    <Clock className="h-3 w-3" /> {balance.pending} Pending Approval
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center justify-center pt-2 border-t border-slate-50">
                {balance.remaining > balance.allocated * 0.5 ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-100/50 uppercase tracking-widest">
                    <TrendingUp className="h-3 w-3" /> Surplus Available
                  </div>
                ) : balance.remaining > 0 ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black border border-amber-100/50 uppercase tracking-widest">
                    <TrendingDown className="h-3 w-3" /> Limited Balance
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-700 text-[10px] font-black border border-red-100/50 uppercase tracking-widest">
                    <TrendingDown className="h-3 w-3" /> Fully Utilized
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

