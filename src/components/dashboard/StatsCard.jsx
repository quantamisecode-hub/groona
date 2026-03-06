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
      <Card className="relative overflow-hidden p-4 sm:p-5 lg:p-4 xl:p-4 bg-white border border-blue-100/70 hover:border-blue-600 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-500 rounded-3xl group flex flex-col justify-between h-full min-h-[8rem] sm:min-h-[9rem] lg:min-h-[8rem] xl:min-h-[10rem]">

        {/* Soft Background Accent Corner */}
        <div className={`absolute top-0 right-0 w-24 sm:w-32 xl:w-40 h-24 sm:h-32 xl:h-40 ${subtleBg} opacity-40 rounded-bl-[5rem] -z-10 transition-transform duration-700 group-hover:scale-125`}></div>
        <div className="absolute -bottom-12 -left-12 w-24 sm:w-32 h-24 sm:h-32 bg-slate-50 opacity-80 rounded-full blur-3xl -z-10"></div>

        {/* Huge Faded Decorative Icon */}
        <div className={`absolute -bottom-6 -right-6 z-0 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 group-hover:scale-110 group-hover:-rotate-12 pointer-events-none ${iconColor}`}>
          <Icon className="w-24 h-24 sm:w-32 sm:h-32 xl:w-40 xl:h-40" />
        </div>

        <div className="flex items-start justify-between relative z-10">
          <p className="text-base sm:text-lg xl:text-xl font-bold text-slate-900 tracking-tight leading-snug">{title}</p>
          <div className="transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1 p-2 sm:p-2.5 rounded-xl bg-white shadow-sm border border-slate-100 ml-2 flex-shrink-0">
            <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${iconColor}`} strokeWidth={2.5} />
          </div>
        </div>

        <div className="mt-4 sm:mt-6 xl:mt-8 relative z-10 flex flex-col">
          <p className="text-4xl sm:text-5xl xl:text-5xl 2xl:text-5xl font-extrabold text-slate-900 tracking-tighter leading-none group-hover:-translate-y-1 transition-transform duration-500">{value}</p>

          {/* Dynamic Expansion Bar */}
          <div className="flex items-center gap-2 mt-3 sm:mt-4">
            <div className={`h-1 rounded-full ${subtleBg.replace('bg-', 'bg-').replace('-50', '-200')} w-6 sm:w-8 group-hover:w-16 sm:group-hover:w-20 group-hover:${iconColor.replace('text-', 'bg-')} transition-all duration-700 shadow-sm shadow-black/5`}></div>
            <div className={`h-1 rounded-full ${subtleBg.replace('bg-', 'bg-').replace('-50', '-100')} w-1 sm:w-2 group-hover:w-3 sm:group-hover:w-4 transition-all duration-700 delay-100`}></div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
