import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format, eachDayOfInterval, isAfter, isBefore, startOfDay, parseISO, isValid } from 'date-fns';
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
    <div className="space-y-4">
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg h-full flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-medium text-slate-500">Sprint Burndown</CardTitle>
            <div className="text-2xl font-bold text-slate-900">
              {remainingEffort} <span className="text-sm font-normal text-slate-500">pts remaining</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-[300px] w-full" style={{ height: '400px' }}>
            {data.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <p className="text-sm">No data available for burndown chart</p>
                  <p className="text-xs text-slate-400 mt-1">Sprint dates or tasks are missing</p>
                  {sprint && (
                    <p className="text-xs text-slate-400 mt-1">
                      Sprint: {sprint.name}, Start: {sprint.start_date?.toString()}, End: {sprint.end_date?.toString()}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIdeal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Area
                  type="monotone"
                  dataKey="ideal"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fillOpacity={1}
                  fill="url(#colorIdeal)"
                  name="Ideal Guideline"
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorActual)"
                  name="Actual Remaining"
                  connectNulls={true}
                />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Guide Section - Separated into its own component to avoid conflicts */}
      <BurndownChartGuide />
    </div>
  );
}