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
    <Card className="bg-white/90 backdrop-blur-xl border-slate-200/60 shadow-lg overflow-hidden">
      <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-blue-50/50 to-purple-50/50 pb-3 sm:pb-4 px-3 sm:px-6 space-y-3">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 sm:h-9 sm:w-9 flex-shrink-0 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
              <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
            </div>
            <CardTitle className="text-sm sm:text-lg font-bold text-slate-900 truncate">Activity Feed</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] sm:text-xs flex-shrink-0 whitespace-nowrap px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/80">
            {filteredActivities.length} / {activities.length}
          </Badge>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Filter className="h-3.5 w-3.5 text-slate-600" />
            <span className="text-xs font-medium text-slate-600 hidden sm:inline">Filters:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 flex-1">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-7 w-full text-xs">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action, idx) => (
                  <SelectItem key={action || `action-${idx}`} value={action} className="capitalize">{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="h-7 w-full text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueEntityTypes.map((type, idx) => (
                  <SelectItem key={type || `type-${idx}`} value={type} className="capitalize">{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="h-7 w-full text-xs">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {uniqueUsers.map((user, idx) => (
                  <SelectItem key={user || `user-${idx}`} value={user}>{user}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-7 w-full text-xs">
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Last 24h</SelectItem>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px] sm:h-[600px]">
          {filteredActivities.length === 0 ? (
            <div className="p-6 sm:p-12 text-center">
              <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <FileText className="h-5 w-5 sm:h-8 sm:w-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-semibold text-sm sm:text-base">
                {activities.length === 0 ? 'No activity yet' : 'No matching activities'}
              </p>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {activities.length === 0 ? 'Activity will appear here as work progresses' : 'Try adjusting your filters'}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-3 text-xs"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="relative px-2 sm:px-6 py-3 sm:py-4">
              {/* Timeline line - precisely centered for all screens */}
              <div className="absolute left-[12px] sm:left-[32px] lg:left-[34px] top-6 bottom-4 w-[1.5px] bg-gradient-to-b from-slate-200 via-slate-200/50 to-transparent" />

              <div className="space-y-2 sm:space-y-3">
                {filteredActivities.map((activity, index) => {
                  const Icon = activityIcons[activity.action] || FileText;
                  const colorClass = activityColors[activity.action] || "text-slate-600 bg-slate-50 border-slate-200";
                  const badgeColor = activityBadgeColors[activity.entity_type] || "bg-slate-100 text-slate-700";

                  return (
                    <div key={activity.id} className="relative flex gap-2 sm:gap-3 group">
                      {/* Icon */}
                      <div className="relative z-10 flex-shrink-0">
                        <div className={`h-7 w-7 sm:h-9 sm:w-9 lg:h-10 lg:w-10 rounded-full flex items-center justify-center border-2 shadow-sm transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg ${colorClass}`}>
                          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5" />
                        </div>
                      </div>

                      {/* Content Card */}
                      <div className="flex-1 min-w-0 pb-2 sm:pb-3">
                        <div className="bg-gradient-to-br from-white to-slate-50/50 rounded-xl lg:rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-200 group-hover:border-blue-300/50 group-hover:bg-white group-hover:-translate-y-0.5">
                          {/* Header Row */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                              <Avatar className="h-5 w-5 sm:h-6 sm:w-6 border-2 border-white shadow-sm flex-shrink-0">
                                <AvatarFallback className="text-[10px] sm:text-xs font-semibold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                  {getInitials(activity.user_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 min-w-0">
                                <span className="font-bold text-[11px] sm:text-xs lg:text-sm text-slate-900 truncate max-w-[100px] sm:max-w-none">
                                  {activity.user_name}
                                </span>
                                <span className="text-[10px] sm:text-xs text-slate-500 lowercase">{activity.action}</span>
                                <Badge className={`${badgeColor} text-[9px] sm:text-[10px] px-2 py-0 sm:py-0.5 font-semibold rounded-full border-0 shadow-none`}>
                                  {activity.entity_type}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-slate-400 flex-shrink-0">
                              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              <span className="whitespace-nowrap">{formatDistanceToNow(new Date(activity.created_date), { addSuffix: true })}</span>
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