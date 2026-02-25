import React from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, CheckCircle2, DollarSign, Clock, AlertCircle, HelpCircle } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUser } from "../shared/UserContext";

const statusColors = {
  planning: "bg-slate-100 text-slate-700 border-slate-200",
  active: "bg-blue-100 text-blue-700 border-blue-200",
  on_hold: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-green-100 text-green-700 border-green-200",
};

const priorityColors = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-600",
  high: "bg-amber-100 text-amber-600",
  urgent: "bg-red-100 text-red-600",
};

export default function ProjectHeader({ project, tasksCount, projectTimesheets = [] }) {
  const { user: currentUser } = useUser();
  // Fetch stories to calculate progress based on Story Points
  const { data: stories = [] } = useQuery({
    queryKey: ['stories', project.id],
    queryFn: async () => {
      if (!project.id) return [];
      return await groonabackend.entities.Story.filter({ project_id: project.id });
    },
    enabled: !!project.id,
    refetchInterval: 2000,
    staleTime: 0,
  });

  // Fetch tasks to calculate completion rate for health score
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', project.id],
    queryFn: async () => {
      if (!project.id) return [];
      return await groonabackend.entities.Task.filter({ project_id: project.id });
    },
    enabled: !!project.id,
    refetchInterval: 2000,
    staleTime: 0,
  });

  const getProjectProgress = () => {
    if (!stories.length) return 0;
    const totalPoints = stories.reduce((sum, story) => sum + (parseInt(story.story_points) || 0), 0);
    const completedPoints = stories
      .filter(s => s.status === 'done')
      .reduce((sum, story) => sum + (parseInt(story.story_points) || 0), 0);

    if (totalPoints === 0) return 0;
    return Math.round((completedPoints / totalPoints) * 100);
  };

  const projectProgress = getProjectProgress();

  // Project Health Calculation (Mirroring Backend & Matrix)
  const healthScore = React.useMemo(() => {
    let score = 70;
    score += (project.progress || 0) * 0.3;

    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const taskCompletionRate = tasks.length > 0 ? completedTasks / tasks.length : 0;
    score += taskCompletionRate * 20;

    if (project.deadline) {
      const daysUntilDeadline = Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline < 0) score -= 20;
      else if (daysUntilDeadline < 7) score -= 10;
    }
    if (project.status === 'on_hold') score -= 15;
    if (project.status === 'completed') score = 100;
    if (project.risk_level === 'critical') score -= 20;
    else if (project.risk_level === 'high') score -= 15;
    else if (project.risk_level === 'medium') score -= 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }, [project, tasks]);

  const isCritical = healthScore < 50;
  const isWarning = healthScore < 70 && healthScore >= 50;

  // 1. Initialize Stats
  let approvedHours = 0;
  let approvedAmount = 0;

  let pendingHours = 0;
  let pendingAmount = 0;

  const currencyBreakdown = {};

  // 2. Loop through ALL billable timesheets (Approved & Submitted)
  projectTimesheets
    .filter(t => t.is_billable && (t.status === 'approved' || t.status === 'submitted'))
    .forEach(timesheet => {
      const hours = (timesheet.total_minutes || 0) / 60;

      // === SAFE RATE CALCULATION ===
      // Force conversion to number to avoid string concatenation bugs
      const rate = Number(timesheet.hourly_rate) || Number(project.default_bill_rate_per_hour) || 0;
      const currency = timesheet.currency || project.currency || 'USD';
      const amount = hours * rate;

      // 3. Separate into Buckets
      if (timesheet.status === 'approved') {
        approvedHours += hours;
        approvedAmount += amount;

        // Track currency for approved
        if (!currencyBreakdown[currency]) currencyBreakdown[currency] = 0;
        currencyBreakdown[currency] += amount;
      } else if (timesheet.status === 'submitted') {
        pendingHours += hours;
        pendingAmount += amount;
      }
    });

  const getCurrencySymbol = (currencyCode) => {
    switch (currencyCode) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'INR': return '₹';
      case 'CAD': return 'C$';
      case 'AUD': return 'A$';
      default: return '$';
    }
  };

  const primaryCurrency = project.currency || Object.keys(currencyBreakdown)[0] || 'USD';
  const primaryCurrencySymbol = getCurrencySymbol(primaryCurrency);

  // Debug check: Do we have approved hours but $0 amount?
  const hasRateWarning = approvedHours > 0 && approvedAmount === 0;

  return (
    <Card className={`p-6 border-slate-200/60 overflow-hidden ${isCritical ? 'bg-red-50/80 border-red-200' : isWarning ? 'bg-amber-50/80 border-amber-200' : 'bg-white/60 backdrop-blur-xl'
      }`} >
      <div className="space-y-6">
        {(isCritical || isWarning) && (
          <div className={`p-4 rounded-xl border flex items-start gap-4 mb-2 ${isCritical ? 'bg-red-100 border-red-200 text-red-900' : 'bg-amber-100 border-amber-200 text-amber-900'
            }`}>
            <AlertCircle className={`h-6 w-6 flex-shrink-0 ${isCritical ? 'text-red-600' : 'text-amber-600'}`} />
            <div>
              <p className="font-bold text-lg">
                {isCritical ? '🚨 Critical Health Risk' : '⚠️ Declining Health Risk'}
              </p>
              <p className="text-sm opacity-90">
                Project health index is {healthScore}%. Review root cause indicators in the dashboard below.
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Badge className={`${statusColors[project.status]} border capitalize`}>
            {project.status.replace('_', ' ')}
          </Badge>
          <Badge className={`${priorityColors[project.priority]} capitalize`}>
            {project.priority} priority
          </Badge>
        </div>

        {project.description && (
          <div className="text-slate-700 text-lg [&>p]:mb-2 last:[&>p]:mb-0">
            <ReactMarkdown>{project.description}</ReactMarkdown>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:flex lg:flex-wrap lg:justify-between gap-6">
          <div className="space-y-2 lg:min-w-[150px]">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>Project Progress</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-slate-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs font-semibold">Project Progress % =</p>
                    <p className="text-xs">(Completed Story Points ÷ Total Story Points) × 100</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="space-y-2">
              <Progress value={projectProgress} className="h-3" />
              <p className="text-2xl font-bold text-slate-900">{projectProgress}%</p>
            </div>
          </div>

          {project.deadline && (
            <div className="space-y-2 lg:min-w-[150px]">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="h-4 w-4" />
                <span>Deadline</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {format(new Date(project.deadline), 'MMM d, yyyy')}
              </p>
            </div>
          )}

          <div className="space-y-2 lg:min-w-[120px]">
            <div className="text-sm text-slate-600">Total Tasks</div>
            <p className="text-2xl font-bold text-slate-900">{tasksCount}</p>
          </div>

          {/* DYNAMIC BILLING FIELDS */}
          {(() => {
            switch (project.billing_model) {
              case 'time_and_materials':
                return (
                  <>
                    <div className="space-y-2 lg:min-w-[150px]">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Clock className="h-4 w-4" />
                        <span>Estimated Duration</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">
                        {project.estimated_duration ? `${project.estimated_duration}h` : '-'}
                      </p>
                    </div>
                    <div className="space-y-2 lg:min-w-[150px]">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <DollarSign className="h-4 w-4" />
                        <span>Default Bill Rate</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">
                        {project.default_bill_rate_per_hour
                          ? `${getCurrencySymbol(project.currency || 'USD')}${project.default_bill_rate_per_hour}/hr`
                          : '-'}
                      </p>
                    </div>
                  </>
                );

              case 'fixed_price':
                return (
                  <>
                    <div className="space-y-2 lg:min-w-[150px]">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <DollarSign className="h-4 w-4" />
                        <span>Fixed Price Amount</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600">
                        {getCurrencySymbol(project.currency || 'USD')}{Number(project.contract_amount || project.budget || project.budget_amount || 0).toLocaleString()}
                      </p>
                    </div>
                    {(project.contract_start_date) && (
                      <div className="space-y-2 lg:min-w-[150px]">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Calendar className="h-4 w-4" />
                          <span>Contract Start</span>
                        </div>
                        <p className="text-xl font-semibold text-slate-900">
                          {format(new Date(project.contract_start_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                    )}
                    {(project.contract_end_date) && (
                      <div className="space-y-2 lg:min-w-[150px]">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Calendar className="h-4 w-4" />
                          <span>Contract End</span>
                        </div>
                        <p className="text-xl font-semibold text-slate-900">
                          {format(new Date(project.contract_end_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                    )}
                  </>
                );

              case 'retainer':
                return (
                  <>
                    <div className="space-y-2 lg:min-w-[150px]">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <DollarSign className="h-4 w-4" />
                        <span>Retainer Amount</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600">
                        {getCurrencySymbol(project.currency || 'USD')}{Number(project.retainer_amount || 0).toLocaleString()}
                        <span className="text-sm text-slate-500 font-normal ml-1">
                          /{project.retainer_period || 'month'}
                        </span>
                      </p>
                    </div>
                    {/* Period is combined above, or can be separate. User asked for "Period". Combined looks better but let's separate if needed.
                        "Retainer Amount,Period,Contract Start Date,Contract End Date"
                        I will show Period separately as requested.
                    */}
                    <div className="space-y-2 lg:min-w-[100px]">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Clock className="h-4 w-4" />
                        <span>Period</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900 capitalize">
                        {project.retainer_period || '-'}
                      </p>
                    </div>
                    {(project.contract_start_date) && (
                      <div className="space-y-2 lg:min-w-[150px]">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Calendar className="h-4 w-4" />
                          <span>Contract Start</span>
                        </div>
                        <p className="text-xl font-semibold text-slate-900">
                          {format(new Date(project.contract_start_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                    )}
                    {(project.contract_end_date) && (
                      <div className="space-y-2 lg:min-w-[150px]">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Calendar className="h-4 w-4" />
                          <span>Contract End</span>
                        </div>
                        <p className="text-xl font-semibold text-slate-900">
                          {format(new Date(project.contract_end_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                    )}
                  </>
                );

              case 'non_billable':
                return (
                  <div className="space-y-2 lg:min-w-[200px]">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>Reason for Non-Billable</span>
                    </div>
                    <p className="text-lg font-medium text-slate-900">
                      {project.non_billable_reason || 'No reason provided'}
                    </p>
                  </div>
                );

              default:
                // Default / Fallback (e.g. for projects created before billing models or if none matched)
                // Shows Billable Hours and Billable Amount as before
                return (
                  <>
                    <div className="space-y-2 lg:min-w-[150px]">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Clock className="h-4 w-4" />
                        <span>Billable Hours</span>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">{approvedHours.toFixed(1)}h</p>
                        {pendingHours > 0 && (
                          <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                            + {pendingHours.toFixed(1)}h pending
                          </p>
                        )}
                      </div>
                    </div>

                    {!currentUser?.custom_role?.includes("project_manager") && (
                      <div className="space-y-2 lg:min-w-[150px]">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <DollarSign className="h-4 w-4" />
                          <span>Billable Amount</span>
                        </div>
                        <div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  <p className={`text-2xl font-bold ${hasRateWarning ? 'text-amber-600' : 'text-green-600'} cursor-help`}>
                                    {primaryCurrencySymbol}{approvedAmount.toFixed(2)}
                                  </p>
                                  {hasRateWarning && <AlertCircle className="h-4 w-4 text-amber-500" />}
                                </div>
                              </TooltipTrigger>

                              <TooltipContent>
                                {hasRateWarning ? (
                                  <p className="text-xs text-amber-200 bg-amber-900 p-2 rounded">
                                    Warning: Hours approved but Amount is 0.<br />
                                    Check Project Default Hourly Rate.
                                  </p>
                                ) : (
                                  Object.keys(currencyBreakdown).length > 0 && (
                                    <div className="text-xs space-y-1">
                                      <p className="font-semibold mb-1">Currency Breakdown:</p>
                                      {Object.entries(currencyBreakdown).map(([currency, amount]) => (
                                        <p key={currency}>
                                          {getCurrencySymbol(currency)}{amount.toFixed(2)} {currency}
                                        </p>
                                      ))}
                                    </div>
                                  )
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Pending Amount Display */}
                          {pendingAmount > 0 && (
                            <p className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-1">
                              <AlertCircle className="h-3 w-3" />
                              + {primaryCurrencySymbol}{pendingAmount.toFixed(2)} pending
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                );
            }
          })()}

        </div>
      </div>
    </Card >
  );
}

