import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import axios from 'axios';
import { API_BASE } from '@/api/groonabackend';
import { CalendarClock, User, Clock } from 'lucide-react';

const DueDateActivityPanel = ({ taskId }) => {
    const { data: logs = [], isLoading, error } = useQuery({
        queryKey: ['dueDateLogs', taskId],
        queryFn: async () => {
            if (!taskId) return [];
            const res = await axios.get(`${API_BASE}/api/tasks/${taskId}/due-date-log`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
            });
            return res.data;
        },
        enabled: !!taskId
    });

    if (isLoading) {
        return (
            <div className="mt-6 p-4 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center min-h-[100px]">
                <span className="text-sm text-gray-500 animate-pulse">Loading activity...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mt-6 p-4 rounded-lg bg-red-50 text-red-600 text-sm">
                Failed to load due date history.
            </div>
        );
    }

    return (
        <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <CalendarClock className="w-4 h-4 text-gray-500" />
                Due Date Activity
            </h3>

            {logs.length === 0 ? (
                <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg text-center">
                    No due date changes yet.
                </div>
            ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {logs.map((log) => (
                        <div key={log._id} className="bg-white border text-sm rounded-lg p-3 shadow-sm relative pl-4 border-l-4 border-l-blue-400">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-1.5 text-gray-700 font-medium">
                                    <User className="w-3.5 h-3.5 text-gray-400" />
                                    <span>{log.changedBy?.username || 'Unknown User'}</span>
                                </div>
                                <div className="flex items-center gap-1 text-gray-400 text-xs" title={format(parseISO(log.changedAt), 'PPp')}>
                                    <Clock className="w-3 h-3" />
                                    <span>{formatDistanceToNow(parseISO(log.changedAt), { addSuffix: true })}</span>
                                </div>
                            </div>

                            {/* Date Change */}
                            <div className="text-gray-600 text-xs mb-2 bg-gray-50 p-1.5 rounded inline-block">
                                <span className="line-through opacity-70">
                                    {log.previousDueDate ? format(parseISO(log.previousDueDate), 'MMM d, yyyy') : 'None'}
                                </span>
                                <span className="mx-2 text-gray-400">→</span>
                                <span className="font-medium text-gray-800">
                                    {log.newDueDate ? format(parseISO(log.newDueDate), 'MMM d, yyyy') : 'None'}
                                </span>
                            </div>

                            {/* Reason */}
                            <div className="mt-1">
                                <p className="text-xs text-gray-500 font-medium mb-0.5">Reason:</p>
                                <p className="text-gray-700 text-sm whitespace-pre-wrap">{log.reason}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DueDateActivityPanel;
