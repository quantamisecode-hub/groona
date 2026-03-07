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
        <Card className="bg-white border-blue-100/60 shadow-sm rounded-[12px] overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                  {isSameDay(today, currentMonth) || isSameMonth(today, currentMonth)
                    ? `Absent Today`
                    : `Team on Leave`}
                </p>
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-[28px] font-black text-slate-900 tracking-tight leading-none">
                    {isSameDay(today, currentMonth) || isSameMonth(today, currentMonth)
                      ? membersAbsentToday
                      : usersOnLeave.length}
                  </p>
                  <span className="text-[13px] font-bold text-blue-400 tracking-tight">Active</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center shadow-inner border border-blue-100/50">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-blue-100/60 shadow-sm rounded-[12px] overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">Total Leaves</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-[28px] font-black text-slate-900 tracking-tight leading-none">
                    {totalLeaves}
                  </p>
                  <span className="text-[13px] font-bold text-sky-400 tracking-tight">Approved</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-sky-50 flex items-center justify-center shadow-inner border border-sky-100/50">
                <Calendar className="h-5 w-5 text-sky-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-blue-100/60 shadow-sm rounded-[12px] overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">Capacity Impact</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-[28px] font-black text-slate-900 tracking-tight leading-none">
                    {Object.values(userCapacityReduction).reduce((sum, r) => sum + r.hours, 0).toFixed(0)}h
                  </p>
                  <span className="text-[13px] font-bold text-indigo-400 tracking-tight">Reduction</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center shadow-inner border border-indigo-100/50">
                <Clock className="h-5 w-5 text-indigo-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Month Calendar */}
      <Card className="bg-white border-blue-100/60 shadow-sm rounded-[12px] overflow-hidden">
        <CardHeader className="border-b border-blue-50/50 px-6 py-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg ring-4 ring-blue-50 transition-transform hover:scale-110">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-[17px] font-black text-slate-900 tracking-tight">
                  {format(currentMonth, 'MMMM yyyy')}
                </CardTitle>
                <p className="text-[13px] font-medium text-slate-400 mt-0.5">Global team availability overview.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
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
                <SelectTrigger className="h-9 w-[180px] bg-blue-50/30 border-blue-100/60 rounded-[10px] text-[12px] font-bold shadow-none focus:bg-white transition-all">
                  <SelectValue placeholder="Filter member..." />
                </SelectTrigger>
                <SelectContent className="rounded-[10px] border-blue-100">
                  <SelectItem value="all" className="text-[12px] font-bold">All Members</SelectItem>
                  {teamMembers.map(member => (
                    <SelectItem key={member.email} value={member.email} className="text-[12px] font-bold">
                      {member.full_name || member.name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isAdmin && (
                <Button
                  onClick={() => setShowAddHoliday(true)}
                  className="h-9 px-4 rounded-[10px] text-[12px] font-bold shadow-sm transition-all bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Holiday
                </Button>
              )}

              <div className="flex items-center bg-blue-50/30 border border-blue-100/60 rounded-[10px] p-0.5">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] hover:bg-white hover:text-blue-600 hover:shadow-sm" onClick={previousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-3 rounded-[8px] text-[11px] font-bold hover:bg-white hover:text-blue-600 hover:shadow-sm" onClick={() => setCurrentMonth(new Date())}>
                  Today
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] hover:bg-white hover:text-blue-600 hover:shadow-sm" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-blue-100 rounded-[10px] hover:bg-blue-50/50"
                onClick={async () => {
                  await Promise.all([
                    refetchLeaves(),
                    refetchHolidays(),
                    queryClient.invalidateQueries({ queryKey: ['team-leaves-calendar'] }),
                    queryClient.invalidateQueries({ queryKey: ['team-members'] }),
                    queryClient.invalidateQueries({ queryKey: ['holidays'] })
                  ]);
                  toast.success('Calendar updated');
                }}
              >
                <RefreshCw className="h-4 w-4 text-blue-400" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[800px] w-full border-t border-blue-50/30">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-blue-50/30 bg-blue-50/10">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                  <div key={day} className="text-center text-[10px] font-black tracking-widest text-blue-300 uppercase py-3 border-r last:border-r-0 border-blue-50/30">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, dayIdx) => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const dayLeaves = leavesByDay[dayKey] || [];
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, today);
                  const isWeekend = getDay(day) === 0 || getDay(day) === 6;

                  return (
                    <div
                      key={dayIdx}
                      onClick={() => {
                        if (dayLeaves.length > 0 && !selectedMember) {
                          setSelectedDate(day);
                          setSelectedMember(null);
                          const memberEmails = [...new Set(dayLeaves.map(l => l.user_email))];
                          const allMemberLeaves = allLeaves.filter(l =>
                            memberEmails.includes(l.user_email)
                          );
                          setSelectedDateLeaves(allMemberLeaves);
                        }
                      }}
                      className={cn(
                        "min-h-[140px] p-2 border-r border-b border-blue-50/30 transition-all",
                        !isCurrentMonth ? "bg-slate-50/30" : isWeekend ? "bg-blue-50/10" : "bg-white",
                        dayLeaves.length > 0 && "hover:bg-blue-50/20 cursor-pointer"
                      )}
                    >
                      {/* Date Header */}
                      <div className="flex items-start justify-between mb-2">
                        <span className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-black transition-all",
                          isToday
                            ? "bg-blue-600 text-white shadow-md ring-4 ring-blue-50"
                            : isCurrentMonth ? "text-slate-800" : "text-slate-300"
                        )}>
                          {format(day, 'd')}
                        </span>

                        {/* Holidays */}
                        {allHolidays.find(h => h.date === dayKey) && (
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-sm" title={allHolidays.find(h => h.date === dayKey)?.name} />
                        )}
                      </div>

                      {/* Leaves */}
                      <div className="space-y-1 mt-2">
                        {dayLeaves.slice(0, 4).map((leave, idx) => {
                          const member = teamMembers.find(m => m.email === leave.user_email);
                          if (!member) return null;

                          return (
                            <div
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(day);
                                setSelectedMember(member);
                                const memberLeaves = allLeaves.filter(l => l.user_email === member.email);
                                setSelectedDateLeaves(memberLeaves);
                              }}
                              className={cn(
                                "flex items-center gap-1.5 p-1 rounded-full border border-blue-50 hover:border-blue-200 hover:shadow-sm transition-all group overflow-hidden",
                                leave.duration === 'half_day' ? "bg-sky-50/60" : "bg-blue-50/40 hover:bg-white"
                              )}
                            >
                              <div className="h-5 w-5 rounded-full bg-white border border-blue-100 flex items-center justify-center text-blue-700 text-[8px] font-bold shadow-sm ring-1 ring-blue-50 shrink-0">
                                {getInitials(member.full_name || member.name)}
                              </div>
                              <span className="text-[10px] font-bold text-blue-700 truncate opacity-0 group-hover:opacity-100 transition-opacity -ml-1 pr-2">
                                {member.full_name?.split(' ')[0]}
                              </span>
                            </div>
                          );
                        })}
                        {dayLeaves.length > 4 && (
                          <p className="text-[9px] font-black text-blue-300 text-center uppercase tracking-tighter mt-1">
                            +{dayLeaves.length - 4} more
                          </p>
                        )}
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden p-0 border-none rounded-[16px] shadow-2xl bg-white flex flex-col">
          <DialogHeader className="px-6 py-6 border-b border-blue-50 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-400">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-[17px] font-black text-slate-800 tracking-tight">
                  {selectedMember
                    ? `${selectedMember.full_name || selectedMember.name}'s Timeline`
                    : `Team Absence • ${selectedDate && format(selectedDate, 'MMM d, yyyy')}`
                  }
                </DialogTitle>
                <DialogDescription className="text-[13px] font-medium text-slate-400 mt-1">
                  Showing {selectedDateLeaves.length} approved leave {selectedDateLeaves.length === 1 ? 'record' : 'records'}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
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
                    <div key={email} className="p-4 rounded-[12px] bg-white border border-slate-200/60 shadow-sm flex flex-col gap-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-700 text-[12px] font-bold shadow-sm ring-4 ring-slate-50">
                            {getInitials(member.full_name || member.name)}
                          </div>
                          <div>
                            <p className="text-[14px] font-black text-slate-800 tracking-tight leading-none">{member.full_name || member.name}</p>
                            <p className="text-[12px] font-medium text-slate-400 mt-1.5">{member.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{capacity.adjustedCapacity.toFixed(0)}h Remaining</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {sortedLeaves.map((leave) => (
                          <div
                            key={leave.id || leave._id}
                            className={cn(
                              "p-3 rounded-[10px] border border-slate-100 group transition-all",
                              leave.duration === 'half_day' ? "bg-amber-50/40 border-amber-100" : "bg-slate-50/50 hover:bg-white"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[12px] font-black tracking-tight text-slate-800">
                                    {format(parseISO(leave.start_date), 'MMM d')} — {format(parseISO(leave.end_date), 'MMM d, yyyy')}
                                  </span>
                                  <Badge className="bg-white text-[9px] font-bold border-slate-200 text-slate-400 rounded-full shadow-none">
                                    {leave.duration === 'half_day' ? 'Half' : 'Full'}
                                  </Badge>
                                </div>
                                <p className="text-[12px] font-medium text-slate-500 italic">“{leave.reason || 'No reason provided'}”</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[13px] font-black text-slate-900 tracking-tight">{leave.total_days}d</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{leave.leave_type_name}</p>
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


