import React, { useMemo, useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, Users, Clock, ChevronLeft, ChevronRight, RefreshCw, X, Plus, Calendar as CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, parseISO, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function TeamCalendar({ currentUser, tenantId }) {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDateLeaves, setSelectedDateLeaves] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [filteredMemberEmail, setFilteredMemberEmail] = useState(null);
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: null,
    type: 'custom',
    description: '',
    is_recurring: false
  });
  const isAdmin = currentUser?.role === 'admin' || currentUser?.is_super_admin;
  const today = new Date();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Fetch all team members (exclude clients)
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u =>
        u.tenant_id === tenantId &&
        !u.is_super_admin &&
        u.custom_role !== 'client'
      );
    },
    enabled: !!tenantId,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  // Fetch all approved leaves for this month - with real-time updates
  const { data: allLeaves = [], refetch: refetchLeaves } = useQuery({
    queryKey: ['team-leaves-calendar', tenantId, monthStart.toISOString()],
    queryFn: () => groonabackend.entities.Leave.filter({
      tenant_id: tenantId,
      status: 'approved'
    }),
    enabled: !!tenantId,
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
  });

  // Fetch holidays
  const { data: holidays = [], refetch: refetchHolidays } = useQuery({
    queryKey: ['holidays', tenantId],
    queryFn: () => groonabackend.entities.Holiday.filter({
      tenant_id: tenantId
    }),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  // Listen for leave approval events to refetch immediately
  React.useEffect(() => {
    const handleLeaveUpdate = () => {
      refetchLeaves();
    };

    window.addEventListener('leave-approved', handleLeaveUpdate);
    window.addEventListener('leave-updated', handleLeaveUpdate);

    return () => {
      window.removeEventListener('leave-approved', handleLeaveUpdate);
      window.removeEventListener('leave-updated', handleLeaveUpdate);
    };
  }, [refetchLeaves]);

  // Filter leaves for this month and by selected member
  const monthLeaves = useMemo(() => {
    if (!allLeaves || allLeaves.length === 0) return [];

    let filtered = allLeaves;

    // Filter by selected member if one is selected
    if (filteredMemberEmail) {
      filtered = filtered.filter(leave => leave.user_email === filteredMemberEmail);
    }

    return filtered.filter(leave => {
      if (!leave.start_date || !leave.end_date) return false;

      try {
        const leaveStart = parseISO(leave.start_date);
        const leaveEnd = parseISO(leave.end_date);

        // Check if leave overlaps with this month
        const overlaps = (
          isWithinInterval(leaveStart, { start: monthStart, end: monthEnd }) ||
          isWithinInterval(leaveEnd, { start: monthStart, end: monthEnd }) ||
          (leaveStart <= monthStart && leaveEnd >= monthEnd)
        );

        return overlaps;
      } catch (error) {
        console.error('Error parsing leave dates:', leave, error);
        return false;
      }
    });
  }, [allLeaves, monthStart, monthEnd, filteredMemberEmail]);

  // Generate real-time holidays (Sundays, national holidays)
  const realTimeHolidays = useMemo(() => {
    const holidayDates = [];
    const currentYear = currentMonth.getFullYear();

    // Add all Sundays
    calendarDays.forEach(day => {
      if (getDay(day) === 0) { // Sunday
        holidayDates.push({
          date: format(day, 'yyyy-MM-dd'),
          name: 'Sunday',
          type: 'weekly',
          is_recurring: true
        });
      }
    });

    // Add national holidays (India - can be customized)
    const nationalHolidays = [
      { month: 0, day: 26, name: 'Republic Day' }, // January 26
      { month: 7, day: 15, name: 'Independence Day' }, // August 15
      { month: 9, day: 2, name: 'Gandhi Jayanti' }, // October 2
    ];

    nationalHolidays.forEach(holiday => {
      const holidayDate = new Date(currentYear, holiday.month, holiday.day);
      if (isWithinInterval(holidayDate, { start: calendarStart, end: calendarEnd })) {
        holidayDates.push({
          date: format(holidayDate, 'yyyy-MM-dd'),
          name: holiday.name,
          type: 'national',
          is_recurring: true
        });
      }
    });

    return holidayDates;
  }, [calendarDays, currentMonth, calendarStart, calendarEnd]);

  // Combine real-time holidays with custom holidays
  const allHolidays = useMemo(() => {
    const customHolidays = holidays.map(h => ({
      date: format(parseISO(h.date), 'yyyy-MM-dd'),
      name: h.name,
      type: h.type || 'custom',
      is_recurring: h.is_recurring || false
    }));
    return [...realTimeHolidays, ...customHolidays];
  }, [holidays, realTimeHolidays]);

  // Group leaves by day and user
  const leavesByDay = useMemo(() => {
    const grouped = {};
    calendarDays.forEach(day => {
      grouped[format(day, 'yyyy-MM-dd')] = [];
    });

    monthLeaves.forEach(leave => {
      if (!leave.start_date || !leave.end_date) return;

      try {
        const leaveStart = parseISO(leave.start_date);
        const leaveEnd = parseISO(leave.end_date);

        // Reset time to start of day for accurate comparison
        const leaveStartDate = new Date(leaveStart.getFullYear(), leaveStart.getMonth(), leaveStart.getDate());
        const leaveEndDate = new Date(leaveEnd.getFullYear(), leaveEnd.getMonth(), leaveEnd.getDate());

        calendarDays.forEach(day => {
          const dayDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());

          // Check if day falls within leave range (inclusive)
          if (dayDate >= leaveStartDate && dayDate <= leaveEndDate) {
            const dayKey = format(day, 'yyyy-MM-dd');
            if (!grouped[dayKey]) grouped[dayKey] = [];
            // Avoid duplicates
            if (!grouped[dayKey].find(l => l.id === leave.id || l._id === leave._id)) {
              grouped[dayKey].push(leave);
            }
          }
        });
      } catch (error) {
        console.error('Error parsing leave dates:', leave, error);
      }
    });

    return grouped;
  }, [monthLeaves, calendarDays]);

  // Calculate capacity reduction per user for the month
  const userCapacityReduction = useMemo(() => {
    const reduction = {};

    teamMembers.forEach(member => {
      const memberLeaves = monthLeaves.filter(l => l.user_email === member.email);
      let totalDays = 0;

      memberLeaves.forEach(leave => {
        if (!leave.start_date || !leave.end_date) return;

        try {
          const leaveStart = parseISO(leave.start_date);
          const leaveEnd = parseISO(leave.end_date);

          // Reset time to start of day for accurate comparison
          const leaveStartDate = new Date(leaveStart.getFullYear(), leaveStart.getMonth(), leaveStart.getDate());
          const leaveEndDate = new Date(leaveEnd.getFullYear(), leaveEnd.getMonth(), leaveEnd.getDate());

          calendarDays.forEach(day => {
            // Only count days in current month
            if (!isSameMonth(day, currentMonth)) return;

            const dayDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());

            // Check if day falls within leave range (inclusive)
            if (dayDate >= leaveStartDate && dayDate <= leaveEndDate) {
              // Only count weekdays (Monday-Friday)
              const dayOfWeek = day.getDay();
              if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                if (leave.duration === 'half_day') {
                  totalDays += 0.5;
                } else {
                  totalDays += 1;
                }
              }
            }
          });
        } catch (error) {
          console.error('Error calculating capacity for leave:', leave, error);
        }
      });

      // Calculate working days in the month (excluding weekends)
      const workingDays = calendarDays.filter(day => {
        const dayOfWeek = day.getDay();
        return dayOfWeek >= 1 && dayOfWeek <= 5 && isSameMonth(day, currentMonth);
      }).length;

      const hoursReduction = totalDays * 8;
      const originalCapacity = workingDays * 8;
      const adjustedCapacity = Math.max(0, originalCapacity - hoursReduction);

      reduction[member.email] = {
        days: totalDays,
        hours: hoursReduction,
        originalCapacity: originalCapacity,
        adjustedCapacity: adjustedCapacity
      };
    });

    return reduction;
  }, [teamMembers, monthLeaves, calendarDays, currentMonth]);

  // Get unique users on leave this month
  const usersOnLeave = useMemo(() => {
    const userEmails = new Set(monthLeaves.map(l => l.user_email));
    return teamMembers.filter(m => userEmails.has(m.email));
  }, [monthLeaves, teamMembers]);

  // Get team members absent today
  const membersAbsentToday = useMemo(() => {
    const todayKey = format(today, 'yyyy-MM-dd');
    const todayLeaves = leavesByDay[todayKey] || [];
    const uniqueMembers = new Set(todayLeaves.map(l => l.user_email));
    return uniqueMembers.size;
  }, [leavesByDay, today]);

  // Count total leaves (not days)
  const totalLeaves = useMemo(() => {
    return monthLeaves.length;
  }, [monthLeaves]);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Group days into weeks for calendar grid
  const weeks = useMemo(() => {
    const weeksArray = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeksArray.push(calendarDays.slice(i, i + 7));
    }
    return weeksArray;
  }, [calendarDays]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">
                  {isSameDay(today, currentMonth) || isSameMonth(today, currentMonth)
                    ? `Team Members Absent Today`
                    : `Team Members on Leave`}
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {isSameDay(today, currentMonth) || isSameMonth(today, currentMonth)
                    ? membersAbsentToday
                    : usersOnLeave.length}
                </p>
                {((isSameDay(today, currentMonth) || isSameMonth(today, currentMonth)) && membersAbsentToday > 0) && (
                  <p className="text-xs text-slate-500 mt-1">
                    {membersAbsentToday === 1 ? 'member' : 'members'} absent today
                  </p>
                )}
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Leaves</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {totalLeaves}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Capacity Reduction</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {Object.values(userCapacityReduction).reduce((sum, r) => sum + r.hours, 0).toFixed(0)}h
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Month Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Team Calendar - {format(currentMonth, 'MMMM yyyy')}
              {filteredMemberEmail && (
                <Badge variant="outline" className="ml-2">
                  {teamMembers.find(m => m.email === filteredMemberEmail)?.full_name || filteredMemberEmail}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1 -mr-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilteredMemberEmail(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Team Member Filter */}
              <Select
                value={filteredMemberEmail || "all"}
                onValueChange={(value) => {
                  setFilteredMemberEmail(value === "all" ? null : value);
                  setSelectedDate(null);
                  setSelectedMember(null);
                  setSelectedDateLeaves([]);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Members</SelectItem>
                  {teamMembers.map(member => (
                    <SelectItem key={member.email} value={member.email}>
                      {member.full_name || member.name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowAddHoliday(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Holiday
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={async () => {
                  await Promise.all([
                    refetchLeaves(),
                    refetchHolidays(),
                    queryClient.invalidateQueries({ queryKey: ['team-leaves-calendar'] }),
                    queryClient.invalidateQueries({ queryKey: ['team-members'] }),
                    queryClient.invalidateQueries({ queryKey: ['holidays'] })
                  ]);
                  toast.success('Calendar refreshed');
                }}
                title="Refresh calendar"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={previousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto px-2 pb-2">
            <div className="min-w-[600px] w-full py-1">
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-slate-500 uppercase p-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, dayIdx) => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const dayLeaves = leavesByDay[dayKey] || [];
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, today);

                  return (
                    <div
                      key={dayIdx}
                      onClick={() => {
                        if (dayLeaves.length > 0 && !selectedMember) {
                          setSelectedDate(day);
                          setSelectedMember(null);
                          // Get all leaves for members on this date (from allLeaves, not just monthLeaves)
                          const memberEmails = [...new Set(dayLeaves.map(l => l.user_email))];
                          const allMemberLeaves = allLeaves.filter(l =>
                            memberEmails.includes(l.user_email)
                          );
                          setSelectedDateLeaves(allMemberLeaves);
                        } else if (dayLeaves.length === 0) {
                          setSelectedDate(null);
                          setSelectedMember(null);
                          setSelectedDateLeaves([]);
                        }
                      }}
                      className={cn(
                        "min-h-[100px] p-2 rounded-lg border-2 transition-all",
                        isCurrentMonth
                          ? "bg-white border-slate-200"
                          : "bg-slate-50 border-slate-100",
                        isToday && "ring-2 ring-blue-500 ring-offset-2",
                        dayLeaves.length > 0 && "border-red-400 hover:border-red-500 hover:shadow-md cursor-pointer"
                      )}
                    >
                      {/* Date Number */}
                      <div className={cn(
                        "text-sm font-semibold mb-2",
                        isToday ? "text-blue-600" : isCurrentMonth ? "text-slate-900" : "text-slate-400"
                      )}>
                        {format(day, 'd')}
                      </div>

                      {/* Holidays */}
                      {allHolidays.find(h => h.date === dayKey) && (
                        <div className="mb-1.5">
                          <Badge variant="outline" className="bg-purple-50 border-purple-300 text-purple-700 text-[9px] px-1.5 py-0.5">
                            {allHolidays.find(h => h.date === dayKey)?.name}
                          </Badge>
                        </div>
                      )}

                      {/* Leave Indicators - Show profile avatar and name with scrollbar (hidden) */}
                      <div className="space-y-1.5 max-h-[70px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {dayLeaves.map((leave, idx) => {
                          const member = teamMembers.find(m => m.email === leave.user_email);
                          if (!member) return null;

                          return (
                            <div
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(day);
                                setSelectedMember(member);
                                // Show only this member's leaves
                                const memberLeaves = allLeaves.filter(l => l.user_email === member.email);
                                setSelectedDateLeaves(memberLeaves);
                              }}
                              className={cn(
                                "flex items-center gap-1.5 p-1.5 rounded border-2 cursor-pointer hover:shadow-sm transition-all",
                                leave.duration === 'half_day'
                                  ? "bg-amber-50 border-amber-300 hover:bg-amber-100"
                                  : "bg-red-50 border-red-300 hover:bg-red-100"
                              )}
                            >
                              <Avatar className="h-6 w-6 flex-shrink-0 border-2 border-white">
                                <AvatarImage src={member.profile_picture_url} />
                                <AvatarFallback className={cn(
                                  "text-[10px] font-semibold",
                                  leave.duration === 'half_day'
                                    ? "bg-amber-500 text-white"
                                    : "bg-red-500 text-white"
                                )}>
                                  {getInitials(member.full_name || member.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate font-semibold text-slate-900 text-[11px]">
                                {member.full_name || member.name || 'Member'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog for selected date details */}
      <Dialog open={!!selectedDate || !!selectedMember} onOpenChange={(open) => {
        if (!open) {
          setSelectedDate(null);
          setSelectedMember(null);
          setSelectedDateLeaves([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {selectedMember
                ? `${selectedMember.full_name || selectedMember.name}'s Leave Details`
                : `Team Members on Leave - ${selectedDate && format(selectedDate, 'MMMM d, yyyy')}`
              }
              {selectedDateLeaves.length > 0 && (
                <span className="text-sm font-normal text-slate-500 ml-2">
                  ({selectedDateLeaves.length} {selectedDateLeaves.length === 1 ? 'leave' : 'leaves'})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {selectedDateLeaves.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No team members on leave for this date</p>
            ) : (
              // Group leaves by member
              (() => {
                const leavesByMember = {};
                selectedDateLeaves.forEach(leave => {
                  if (!leavesByMember[leave.user_email]) {
                    leavesByMember[leave.user_email] = [];
                  }
                  leavesByMember[leave.user_email].push(leave);
                });

                return Object.entries(leavesByMember).map(([email, memberLeaves]) => {
                  const member = teamMembers.find(m => m.email === email);
                  if (!member) return null;

                  const capacity = userCapacityReduction[member.email] || {
                    days: 0,
                    hours: 0,
                    originalCapacity: 0,
                    adjustedCapacity: 0
                  };

                  // Sort leaves by start date (most recent first)
                  const sortedLeaves = [...memberLeaves].sort((a, b) => {
                    return new Date(b.start_date) - new Date(a.start_date);
                  });

                  return (
                    <div key={email} className="p-4 border border-slate-200 rounded-lg bg-white hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-4 mb-4">
                        <Avatar className="h-14 w-14 flex-shrink-0">
                          <AvatarImage src={member.profile_picture_url} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-lg">
                            {getInitials(member.full_name || member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-semibold text-slate-900 text-lg">
                                {member.full_name || member.name || member.email}
                              </p>
                              <p className="text-sm text-slate-600">{member.email}</p>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                                <Clock className="h-4 w-4" />
                                <span className="font-medium">
                                  {capacity.adjustedCapacity.toFixed(0)}h / {capacity.originalCapacity.toFixed(0)}h
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* All Leaves for this member */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-slate-500 uppercase mb-2">All Approved Leaves:</p>
                        {sortedLeaves.map((leave) => (
                          <div
                            key={leave.id || leave._id}
                            className={cn(
                              "p-3 rounded-lg border-2",
                              leave.duration === 'half_day'
                                ? "bg-amber-50 border-amber-200"
                                : "bg-red-50 border-red-200"
                            )}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-xs",
                                      leave.duration === 'half_day'
                                        ? "bg-amber-100 border-amber-300 text-amber-700"
                                        : "bg-red-100 border-red-300 text-red-700"
                                    )}
                                  >
                                    {leave.leave_type_name || leave.leave_type?.replace('_', ' ') || 'Leave'}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {leave.duration === 'half_day' ? 'Half Day' : 'Full Day'}
                                  </Badge>
                                </div>
                                <p className="text-sm font-semibold text-slate-900 mb-1">
                                  📅 {format(parseISO(leave.start_date), 'MMM d, yyyy')} - {format(parseISO(leave.end_date), 'MMM d, yyyy')}
                                </p>
                                {leave.reason && (
                                  <p className="text-xs text-slate-600 mt-1">
                                    Reason: {leave.reason}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-slate-500">
                                  {leave.total_days} {leave.total_days === 1 ? 'day' : 'days'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Holiday Dialog */}
      <Dialog open={showAddHoliday} onOpenChange={setShowAddHoliday}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Holiday</DialogTitle>
            <DialogDescription>
              Add a custom holiday that will appear in the team calendar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Holiday Name</Label>
              <Input
                value={holidayForm.name}
                onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                placeholder="e.g., Company Holiday"
              />
            </div>
            <div>
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !holidayForm.date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {holidayForm.date ? format(holidayForm.date, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={holidayForm.date}
                    onSelect={(date) => setHolidayForm({ ...holidayForm, date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={holidayForm.type}
                onValueChange={(value) => setHolidayForm({ ...holidayForm, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="regional">Regional</SelectItem>
                  <SelectItem value="national">National</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description (Optional)</Label>
              <Textarea
                value={holidayForm.description}
                onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                placeholder="Add a description for this holiday"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="recurring"
                checked={holidayForm.is_recurring}
                onChange={(e) => setHolidayForm({ ...holidayForm, is_recurring: e.target.checked })}
                className="rounded border-slate-300"
              />
              <Label htmlFor="recurring" className="cursor-pointer">
                Recurring annually
              </Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddHoliday(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!holidayForm.name || !holidayForm.date) {
                    toast.error('Please fill in all required fields');
                    return;
                  }
                  try {
                    await groonabackend.entities.Holiday.create({
                      tenant_id: tenantId,
                      name: holidayForm.name,
                      date: format(holidayForm.date, 'yyyy-MM-dd'),
                      type: holidayForm.type,
                      description: holidayForm.description,
                      is_recurring: holidayForm.is_recurring,
                      created_by: currentUser.email,
                      created_at: new Date().toISOString()
                    });
                    toast.success('Holiday added successfully');
                    setHolidayForm({ name: '', date: null, type: 'custom', description: '', is_recurring: false });
                    setShowAddHoliday(false);
                    refetchHolidays();
                    queryClient.invalidateQueries({ queryKey: ['holidays'] });
                  } catch (error) {
                    toast.error('Failed to add holiday: ' + error.message);
                  }
                }}
              >
                Add Holiday
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


