import React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function StatsCard({ title, value, icon: Icon, iconColor = "text-blue-600", loading }) {
  if (loading) {
    return (
      <Card className="p-6 bg-white border border-blue-50 shadow-[0_2px_12px_rgba(0,0,0,0.02)] rounded-[28px]">
        <Skeleton className="h-[90px] w-full" />
      </Card>
    );
  }

  // Derive a very subtle background color based on the iconColor string if possible, fallback to slate.
  // This helps the card feel cohesive.
  const colorMap = {
    'text-blue-600': 'bg-blue-50',
    'text-purple-600': 'bg-purple-50',
    'text-green-600': 'bg-green-50',
    'text-orange-600': 'bg-orange-50',
    'text-red-600': 'bg-red-50',
  };
  const subtleBg = colorMap[iconColor] || 'bg-slate-50';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <Card className="relative overflow-hidden p-6 bg-white border border-blue-100/70 hover:border-blue-600 shadow-[0_2px_12px_rgba(0,0,0,0.015)] hover:shadow-[0_8px_24px_rgba(59,130,246,0.08)] transition-all duration-400 rounded-[28px] group flex flex-col justify-between h-full min-h-[160px]">

        {/* Soft Background Accent Corner */}
        <div className={`absolute top-0 right-0 w-32 h-32 ${subtleBg} opacity-50 rounded-bl-[100px] -z-10 transition-transform duration-500 group-hover:scale-125`}></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-slate-50 opacity-80 rounded-full blur-2xl -z-10"></div>

        {/* Huge Faded Decorative Icon */}
        <div className={`absolute -bottom-4 -right-4 z-0 opacity-[0.04] group-hover:opacity-[0.08] transition-all duration-500 group-hover:scale-110 group-hover:-rotate-12 pointer-events-none ${iconColor}`}>
          <Icon className="w-32 h-32" />
        </div>

        <div className="flex items-start justify-between relative z-10">
          <p className="text-[17px] font-bold text-slate-900 tracking-tight">{title}</p>
          <div className="transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5 p-2 rounded-[14px] bg-white shadow-sm border border-slate-100 ml-2 flex-shrink-0">
            <Icon className={`h-[18px] w-[18px] ${iconColor}`} strokeWidth={2.5} />
          </div>
        </div>

        <div className="mt-6 relative z-10 flex flex-col">
          <p className="text-[56px] font-extrabold text-[#0B1120] tracking-tighter leading-none group-hover:-translate-y-1 transition-transform duration-300">{value}</p>

          {/* Dynamic Expansion Bar */}
          <div className="flex items-center gap-1.5 mt-3">
            <div className={`h-1 rounded-full ${subtleBg.replace('bg-', 'bg-').replace('-50', '-200')} w-6 group-hover:w-16 group-hover:${iconColor.replace('text-', 'bg-')} transition-all duration-500 ease-out`}></div>
            <div className={`h-1 rounded-full ${subtleBg.replace('bg-', 'bg-').replace('-50', '-100')} w-1.5 group-hover:w-3 transition-all duration-500 delay-75 ease-out`}></div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
