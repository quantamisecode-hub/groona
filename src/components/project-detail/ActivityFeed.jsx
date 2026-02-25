import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  CheckCircle2,
  MessageSquare,
  Edit,
  Plus,
  Trash2,
  User,
  Activity,
  Clock,
  Filter,
  X
} from "lucide-react";
import { formatDistanceToNow, format, subDays, isAfter } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

const activityIcons = {
  created: Plus,
  updated: Edit,
  completed: CheckCircle2,
  commented: MessageSquare,
  deleted: Trash2,
  assigned: User,
};

const activityColors = {
  created: "text-green-600 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200",
  updated: "text-blue-600 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200",
  completed: "text-purple-600 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200",
  commented: "text-amber-600 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200",
  deleted: "text-red-600 bg-gradient-to-br from-red-50 to-rose-50 border-red-200",
  assigned: "text-cyan-600 bg-gradient-to-br from-cyan-50 to-sky-50 border-cyan-200",
};

const activityBadgeColors = {
  task: "bg-blue-100 text-blue-700",
  project: "bg-purple-100 text-purple-700",
  comment: "bg-amber-100 text-amber-700",
  document: "bg-green-100 text-green-700",
};

const getInitials = (name) => {
  if (!name) return "U";
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export default function ActivityFeed({ activities, loading }) {
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // Get unique values for filters
  const uniqueActions = useMemo(() => [...new Set(activities.map(a => a.action).filter(Boolean))], [activities]);
  const uniqueEntityTypes = useMemo(() => [...new Set(activities.map(a => a.entity_type).filter(Boolean))], [activities]);
  const uniqueUsers = useMemo(() => [...new Set(activities.map(a => a.user_name).filter(Boolean))], [activities]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      const actionMatch = actionFilter === "all" || activity.action === actionFilter;
      const entityMatch = entityFilter === "all" || activity.entity_type === entityFilter;
      const userMatch = userFilter === "all" || activity.user_name === userFilter;

      let dateMatch = true;
      if (dateFilter !== "all") {
        const activityDate = new Date(activity.created_date);
        const now = new Date();
        if (dateFilter === "today") {
          dateMatch = isAfter(activityDate, subDays(now, 1));
        } else if (dateFilter === "week") {
          dateMatch = isAfter(activityDate, subDays(now, 7));
        } else if (dateFilter === "month") {
          dateMatch = isAfter(activityDate, subDays(now, 30));
        }
      }

      return actionMatch && entityMatch && userMatch && dateMatch;
    });
  }, [activities, actionFilter, entityFilter, userFilter, dateFilter]);

  const clearFilters = () => {
    setActionFilter("all");
    setEntityFilter("all");
    setUserFilter("all");
    setDateFilter("all");
  };

  const hasActiveFilters = actionFilter !== "all" || entityFilter !== "all" || userFilter !== "all" || dateFilter !== "all";

  if (loading) {
    return (
      <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/90 backdrop-blur-xl border-slate-200/60 shadow-lg overflow-hidden mr-2">
      <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-blue-50/50 to-purple-50/50 p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 overflow-hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 flex-shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Activity className="h-4.5 w-4.5 text-white" />
            </div>
            <CardTitle className="text-base sm:text-lg font-bold text-slate-900 truncate tracking-tight">Activity Feed</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold whitespace-nowrap px-2 py-0.5 bg-white/80 border-slate-200 text-slate-600 shrink-0">
            {filteredActivities.length} / {activities.length}
          </Badge>
        </div>

        {/* Filters Section - Flexible layout */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 flex-shrink-0 opacity-80">
            <Filter className="h-3 w-3 text-slate-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Quick Filters</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <div className="flex-1 min-w-[100px] max-w-full">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-7 w-full text-[10px] px-2 bg-white/50 border-slate-200">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {uniqueActions.map((action, idx) => (
                    <SelectItem key={action || `action-${idx}`} value={action} className="capitalize text-[10px]">{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[100px] max-w-full">
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="h-7 w-full text-[10px] px-2 bg-white/50 border-slate-200">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueEntityTypes.map((type, idx) => (
                    <SelectItem key={type || `type-${idx}`} value={type} className="capitalize text-[10px]">{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[100px] max-w-full">
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="h-7 w-full text-[10px] px-2 bg-white/50 border-slate-200">
                  <SelectValue placeholder="User" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {uniqueUsers.map((user, idx) => (
                    <SelectItem key={user || `user-${idx}`} value={user} className="text-[10px]">{user}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[110px] max-w-full">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="h-8 w-full text-[10px] px-3 bg-white/60 border-slate-200 hover:bg-white transition-colors">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today" className="text-[10px]">Last 24h</SelectItem>
                  <SelectItem value="week" className="text-[10px]">Last Week</SelectItem>
                  <SelectItem value="month" className="text-[10px]">Last Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 px-2 text-[10px] text-slate-500 hover:text-red-600 hover:bg-red-50"
              >
                <X className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px] sm:h-[600px]">
          {filteredActivities.length === 0 ? (
            <div className="p-8 sm:p-14 text-center">
              <div className="h-14 w-14 sm:h-18 sm:w-18 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center mx-auto mb-4 border border-slate-200/50">
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-slate-300" />
              </div>
              <p className="text-slate-600 font-bold text-sm sm:text-base tracking-tight">
                {activities.length === 0 ? 'No activity yet' : 'No matching activities'}
              </p>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-[200px] mx-auto">
                {activities.length === 0 ? 'Activity will appear here as work progresses' : 'Try adjusting your filters'}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-5 text-xs h-8 px-4 rounded-lg"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="relative p-4 pr-10 sm:p-6 sm:pr-12 lg:p-8 lg:pr-16">
              {/* Timeline line - centrally aligned with the icon center */}
              <div className="absolute left-[36px] sm:left-[46px] lg:left-[54px] top-8 bottom-6 w-[1px] bg-gradient-to-b from-slate-200 via-slate-200/50 to-transparent" />

              <div className="space-y-2 sm:space-y-3">
                {filteredActivities.map((activity, index) => {
                  const Icon = activityIcons[activity.action] || FileText;
                  const colorClass = activityColors[activity.action] || "text-slate-600 bg-slate-50 border-slate-200";
                  const badgeColor = activityBadgeColors[activity.entity_type] || "bg-slate-100 text-slate-700";

                  return (
                    <div key={activity.id} className="relative flex gap-3 sm:gap-4 lg:gap-6 group mb-4 last:mb-0">
                      {/* Icon Container */}
                      <div className="relative z-10 flex-shrink-0">
                        <div className={`h-10 w-10 sm:h-11 sm:w-11 rounded-full flex items-center justify-center border-2 shadow-sm transition-all duration-200 group-hover:scale-105 group-hover:shadow-lg ${colorClass}`}>
                          <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                        </div>
                      </div>

                      {/* Content Card */}
                      <div className="flex-1 min-w-0 pb-2 sm:pb-3">
                        <div className="bg-gradient-to-br from-white to-slate-50/50 rounded-xl lg:rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-200 group-hover:border-blue-300/50 group-hover:bg-white group-hover:-translate-y-0.5">
                          {/* Header Row - Improved for narrow columns */}
                          <div className="flex flex-col gap-2 mb-2">
                            <div className="flex items-start justify-between gap-2 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar className="h-6 w-6 border-2 border-white shadow-sm flex-shrink-0">
                                  <AvatarFallback className="text-[10px] font-semibold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                    {getInitials(activity.user_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-xs text-slate-900 truncate">
                                    {activity.user_name}
                                  </span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-slate-500 capitalize">{activity.action}</span>
                                    <Badge className={`${badgeColor} text-[9px] px-1.5 py-0 font-semibold rounded-full border-0 shadow-none h-4`}>
                                      {activity.entity_type}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-[9px] text-slate-400 flex-shrink-0 bg-slate-50 px-1.5 py-0.5 rounded-full border border-slate-100 uppercase tracking-tighter">
                                <Clock className="h-2 w-2" />
                                <span className="whitespace-nowrap font-medium">{formatDistanceToNow(new Date(activity.created_date), { addSuffix: true })}</span>
                              </div>
                            </div>
                          </div>

                          {/* Entity Name */}
                          <p className="text-[11px] sm:text-xs lg:text-sm font-semibold text-slate-800 mb-0.5 sm:mb-1 break-words line-clamp-2">
                            {activity.entity_name}
                          </p>

                          {/* Details */}
                          {activity.details && (
                            <p className="text-[10px] sm:text-xs text-slate-600 bg-slate-100/80 rounded-md p-1.5 sm:p-2 mt-1 sm:mt-2 border border-slate-200/50 break-words line-clamp-3">
                              {activity.details}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}