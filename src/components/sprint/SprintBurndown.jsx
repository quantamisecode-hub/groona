import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format, eachDayOfInterval, isAfter, isBefore, startOfDay, parseISO, isValid } from 'date-fns';
import { TrendingUp } from 'lucide-react';
import BurndownChartGuide from './BurndownChartGuide';

export default function SprintBurndown({ sprint, tasks }) {
  const data = useMemo(() => {
    if (!sprint || !sprint.start_date || !sprint.end_date || !tasks || !Array.isArray(tasks)) return [];

    let start, end;
    try {
      // Handle different date formats: Date object, ISO string, or other string formats
      if (sprint.start_date instanceof Date) {
        start = sprint.start_date;
      } else if (typeof sprint.start_date === 'string') {
        start = parseISO(sprint.start_date);
        // If parseISO fails, try new Date
        if (!isValid(start)) {
          start = new Date(sprint.start_date);
        }
      } else {
        start = new Date(sprint.start_date);
      }

      if (sprint.end_date instanceof Date) {
        end = sprint.end_date;
      } else if (typeof sprint.end_date === 'string') {
        end = parseISO(sprint.end_date);
        // If parseISO fails, try new Date
        if (!isValid(end)) {
          end = new Date(sprint.end_date);
        }
      } else {
        end = new Date(sprint.end_date);
      }

      // Validate dates
      if (!isValid(start) || !isValid(end) || isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.warn('SprintBurndown: Invalid dates', { start_date: sprint.start_date, end_date: sprint.end_date });
        return [];
      }

      // Ensure end is after start
      if (end <= start) {
        console.warn('SprintBurndown: End date must be after start date', { start, end });
        return [];
      }
    } catch (e) {
      console.error('SprintBurndown: Error parsing dates', e);
      return [];
    }

    const today = startOfDay(new Date());

    // Generate all days in sprint
    let days = [];
    try {
      days = eachDayOfInterval({ start, end });
      if (!days || days.length === 0) {
        return [];
      }
    } catch (e) {
      // Fallback for invalid range
      return [];
    }

    // Calculate total story points/hours
    const totalEffort = tasks.reduce((sum, t) => {
      const points = Number(t.story_points) || 0;
      const hours = Number(t.estimated_hours) || 0;
      return sum + (points || hours || 0);
    }, 0);

    // If no effort, still show the chart with 0 effort
    const idealBurnRate = totalEffort > 0 ? totalEffort / Math.max(days.length - 1, 1) : 0; // Linear burn

    // Calculate current remaining effort (for future dates)
    const currentBurnedPoints = tasks.reduce((sum, t) => {
      if (t.status !== 'completed') return sum;
      const points = Number(t.story_points) || 0;
      const hours = Number(t.estimated_hours) || 0;
      return sum + (points || hours || 0);
    }, 0);
    const currentRemaining = Math.max(0, totalEffort - currentBurnedPoints);

    return days.map((day, index) => {
      const isFuture = isAfter(day, today) && !isBefore(day, start); // Is strictly in the future relative to today

      // IDEAL LINE:
      // Start at totalEffort, reach 0 at the end
      const ideal = Math.max(0, totalEffort - (idealBurnRate * index));

      // ACTUAL LINE:
      // For each day, calculate how much was remaining at the END of that day
      // A task is burned if completed_date <= day (end of day)
      let actual = totalEffort; // Default to total effort if no tasks completed

      // For past or today: calculate based on completed tasks up to that day
      // For future: show current remaining effort
      if (!isFuture) {
        const burnedPoints = tasks.reduce((sum, t) => {
          if (t.status !== 'completed') return sum;

          let doneDate = null;
          if (t.completed_date) {
            try {
              if (t.completed_date instanceof Date) {
                doneDate = t.completed_date;
              } else {
                doneDate = parseISO(t.completed_date);
                if (!isValid(doneDate)) {
                  doneDate = new Date(t.completed_date);
                }
              }
            } catch (e) {
              doneDate = null;
            }
          }

          if ((!doneDate || !isValid(doneDate)) && t.updated_date) {
            try {
              if (t.updated_date instanceof Date) {
                doneDate = t.updated_date;
              } else {
                doneDate = parseISO(t.updated_date);
                if (!isValid(doneDate)) {
                  doneDate = new Date(t.updated_date);
                }
              }
            } catch (e) {
              doneDate = null;
            }
          }

          // If no date (legacy data), assume it was burned at start of sprint
          if (!doneDate || !isValid(doneDate)) {
            doneDate = start; // Legacy fallback
          }

          // If task was completed ON or BEFORE this 'day'
          // use end of day comparison, so set day to 23:59:59
          const dayEnd = new Date(day);
          dayEnd.setHours(23, 59, 59, 999);

          if (doneDate && isValid(doneDate) && doneDate <= dayEnd) {
            const points = Number(t.story_points) || 0;
            const hours = Number(t.estimated_hours) || 0;
            return sum + (points || hours || 0);
          }
          return sum;
        }, 0);
        actual = Math.max(0, totalEffort - burnedPoints);
      } else {
        // For future dates, show current remaining effort
        actual = currentRemaining;
      }

      return {
        date: format(day, 'MMM d'),
        ideal: parseFloat(ideal.toFixed(1)),
        actual: parseFloat(actual.toFixed(1))
      };
    });
  }, [sprint, tasks]);

  const totalEffort = tasks?.reduce((sum, t) => sum + (Number(t.story_points) || Number(t.estimated_hours) || 0), 0) || 0;
  const completedEffort = tasks?.filter(t => t.status === 'completed').reduce((sum, t) => sum + (Number(t.story_points) || Number(t.estimated_hours) || 0), 0) || 0;
  const remainingEffort = totalEffort - completedEffort;

  // Debug logging (remove in production if needed)
  React.useEffect(() => {
    if (data.length > 0) {
      console.log('SprintBurndown data:', {
        dataLength: data.length,
        firstItem: data[0],
        lastItem: data[data.length - 1],
        sprint: sprint?.name,
        tasksCount: tasks?.length,
        totalEffort
      });
    } else {
      console.warn('SprintBurndown: No data generated', {
        sprint: sprint?.name,
        hasStartDate: !!sprint?.start_date,
        hasEndDate: !!sprint?.end_date,
        tasksCount: tasks?.length,
        tasks: tasks
      });
    }
  }, [data, sprint, tasks, totalEffort]);

  return (
    <div className="space-y-6">
      <Card className="bg-white/70 backdrop-blur-xl border-slate-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[28px] overflow-hidden transition-all duration-500 hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] group">
        <CardHeader className="p-8 pb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Sprint Burndown</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase">Progress Tracking</span>
                </div>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-slate-900 tracking-tighter">{remainingEffort}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">pts remaining</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 pt-4">
          <div className="h-[420px] w-full">
            {data.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50/50 rounded-[20px] border border-dashed border-slate-200">
                <div className="h-16 w-16 bg-white rounded-3xl flex items-center justify-center mb-4 shadow-sm">
                  <TrendingUp className="h-8 w-8 text-slate-200" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Insufficient Data</h3>
                <p className="text-sm font-medium text-slate-400 max-w-xs mx-auto text-center mt-2 leading-relaxed">
                  {sprint?.start_date && sprint?.end_date
                    ? "This sprint doesn't have enough tasks or completed work history to generate a burndown visual."
                    : "Please set sprint start and end dates to enable progress tracking."}
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorIdeal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                    </linearGradient>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    fontSize={10}
                    fontFamily="inherit"
                    fontWeight={700}
                    tick={{ fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    fontSize={10}
                    fontFamily="inherit"
                    fontWeight={700}
                    tick={{ fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    dx={-10}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-slate-100 min-w-[150px]">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-50 pb-2">{label}</p>
                            <div className="space-y-2">
                              {payload.map((entry, index) => (
                                <div key={index} className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">{entry.name}</span>
                                  </div>
                                  <span className="text-[13px] font-black text-slate-800">{entry.value} pts</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingTop: '0px', paddingBottom: '30px' }}
                    iconType="circle"
                    formatter={(value) => <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{value}</span>}
                  />
                  <Area
                    type="monotone"
                    dataKey="ideal"
                    stroke="#cbd5e1"
                    strokeWidth={2}
                    strokeDasharray="8 8"
                    fillOpacity={1}
                    fill="url(#colorIdeal)"
                    name="Ideal Guideline"
                    animationDuration={1500}
                    animationEasing="ease-in-out"
                  />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    stroke="#6366f1"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorActual)"
                    name="Actual Remaining"
                    connectNulls={true}
                    animationDuration={2000}
                    animationEasing="ease-in-out"
                    style={{ filter: 'url(#glow)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <BurndownChartGuide />
    </div>
  );
}