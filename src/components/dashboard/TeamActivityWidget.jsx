import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from 'date-fns';
import { cn } from "@/lib/utils";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from "@/utils";

export default function TeamActivityWidget({ activities = [] }) {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Only take top 4 activities to match the design height
    const displayActivities = activities.slice(0, 4);

    const handleEntityClick = (activity) => {
        if (!activity.entity_id) return;

        const type = (activity.entity_type || '').toLowerCase();
        if (type === 'project') {
            navigate(`${createPageUrl("ProjectDetail")}?id=${activity.entity_id}`);
        } else if (type === 'task' || type === 'story') {
            // Dashboard detail modal watches for `taskId` in the URL search params
            searchParams.set('taskId', activity.entity_id);
            setSearchParams(searchParams);
        } else if (type === 'sprint') {
            navigate(`${createPageUrl("SprintPlanningPage")}?sprintId=${activity.entity_id}`);
        }
    };

    const renderActivityContent = (activity) => {
        // Simple formatter for action and entity
        const action = (activity.action || '').toLowerCase();
        const entityName = activity.entity_name || 'an item';

        // If we have both action and entity_name, we can format it nicely
        if (action && activity.entity_name) {
            let prefixText = '';
            if (action.includes('create') || action.includes('add')) prefixText = 'Created';
            else if (action.includes('update') || action.includes('edit')) prefixText = 'Updated';
            else if (action.includes('delete') || action.includes('remove')) prefixText = 'Deleted';
            else if (action.includes('join')) prefixText = 'Joined the';
            else if (action.includes('upload')) prefixText = 'Uploaded files to';
            else if (action.includes('comment')) prefixText = 'Commented on';
            else prefixText = activity.action;

            return (
                <span className="text-[14px] text-slate-500">
                    {prefixText}{' '}
                    <span
                        className={cn("font-medium", activity.entity_id ? "text-blue-500 cursor-pointer hover:underline" : "text-slate-700")}
                        onClick={() => handleEntityClick(activity)}
                    >
                        {entityName}
                    </span>
                    {action.includes('join') ? ' project' : ''}
                </span>
            );
        }

        // Fallback to details string
        return (
            <span className="text-[14px] text-slate-500">
                {activity.details || 'Performed an action'}
            </span>
        );
    };

    return (
        <Card className="w-full flex flex-col bg-white border-0 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-100/80 rounded-[28px] overflow-hidden">
            <CardHeader className="p-6 pb-2 flex-shrink-0">
                <CardTitle className="text-[19px] font-bold text-slate-900 tracking-tight">Team Activity</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-2 flex-grow flex flex-col">
                {displayActivities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 min-h-[180px] text-slate-400 font-medium text-[13px]">
                        No recent activity.
                    </div>
                ) : (
                    <div className="relative pl-3 mt-2 flex-1">
                        {/* Connecting Line */}
                        <div className="absolute left-[15px] top-[8px] bottom-[32px] w-[2px] bg-slate-100/80 z-0"></div>

                        <div className="flex flex-col gap-6">
                            {displayActivities.map((activity, index) => {
                                const isFirst = index === 0;
                                const dateStr = activity.created_date || activity.created_at;
                                const timeAgo = dateStr
                                    ? formatDistanceToNow(new Date(dateStr), { addSuffix: true })
                                    : 'A while ago';

                                return (
                                    <div key={activity.id || index} className="flex gap-4 relative z-10 w-full group">
                                        {/* Timeline Dot */}
                                        <div className="relative flex-shrink-0 mt-1">
                                            <div className={cn(
                                                "w-2.5 h-2.5 rounded-full ring-4 ring-white shadow-sm relative z-10",
                                                isFirst ? "bg-blue-500" : "bg-slate-300"
                                            )} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex flex-col pt-0">
                                            <span className="text-[15px] font-bold text-slate-900 leading-tight mb-1 tracking-tight">
                                                {activity.user_name || activity.user_email?.split('@')[0] || 'System User'}
                                            </span>

                                            <div className="mb-0.5">
                                                {renderActivityContent(activity)}
                                            </div>

                                            <span className="text-[12px] text-slate-400/80 font-medium flex items-center">
                                                {timeAgo.replace('about ', '')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
