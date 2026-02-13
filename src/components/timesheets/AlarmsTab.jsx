import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Bell,
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  Siren
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AlarmsTab({ currentUser, users = [] }) {
  const queryClient = useQueryClient();

  // Fetch all APPEALED notifications
  const { data: appealedAlarms = [], isLoading } = useQuery({
    queryKey: ['appealed-alarms'],
    queryFn: async () => {
      // Fetch both appealed and open alarms to provide context for PMs
      const notifications = await groonabackend.entities.Notification.filter({}, '-created_date');
      return notifications.filter(n =>
        (n.status === 'APPEALED') ||
        (n.status === 'OPEN' && (n.category === 'alarm' || n.type === 'user_streak_escalation')) ||
        (n.status === 'RESOLVED' && n.type === 'timesheet_lockout_alarm')
      );
    },
    refetchInterval: 10000, // Poll every 10s
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, status, type }) => {
      if (type === 'timesheet_lockout_alarm' && status === 'RESOLVED') {
        // Use specialized backend function to reset ignored count
        return groonabackend.functions.invoke('resolveLockoutAppeal', {
          notificationId: id,
          resolvedBy: currentUser.email
        });
      }
      return groonabackend.entities.Notification.update(id, {
        status: status,
        read: true,
        resolved_at: new Date().toISOString(),
        resolved_by: currentUser.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appealed-alarms'] });
      queryClient.invalidateQueries({ queryKey: ['mandatory-timesheet-check'] });
      queryClient.invalidateQueries({ queryKey: ['task-notifications'] });
      toast.success("Alarm status updated successfully");
    },
    onError: () => {
      toast.error("Failed to update alarm status");
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const pendingAppeals = appealedAlarms.filter(a => a.status === 'APPEALED');
  const activeAlarms = appealedAlarms.filter(a => a.status === 'OPEN');

  if (appealedAlarms.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 mt-4">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Bell className="h-8 w-8 text-slate-400" />
          </div>
          <CardTitle className="text-slate-900 mb-2">No Active Alarms</CardTitle>
          <CardDescription>All critical alarms and appeals have been processed.</CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="h-5 w-5 text-red-600" />
        <h3 className="text-lg font-bold text-slate-900">Active Critical Alarms</h3>
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          {appealedAlarms.length} Critical Items
        </Badge>
      </div>

      <div className="grid gap-4">
        {appealedAlarms.map((alarm) => {
          const user = users.find(u => u.email === alarm.recipient_email);

          return (
            <Card key={alarm.id} className="border-slate-200 hover:border-blue-200 transition-all shadow-sm">
              <CardContent className="p-0">
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12 ring-2 ring-slate-100 ring-offset-2">
                        <AvatarImage src={user?.profile_image_url} />
                        <AvatarFallback className="bg-slate-100 text-slate-600 font-bold">
                          {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-lg">
                            {user?.full_name || alarm.recipient_email}
                          </span>
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none capitalize">
                            {alarm.type.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {alarm.appealed_at ? format(new Date(alarm.appealed_at), "PPp") : 'Just now'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {alarm.status === 'APPEALED' ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50 gap-2"
                            onClick={() => resolveMutation.mutate({ id: alarm.id, status: 'OPEN', type: alarm.type })}
                            disabled={resolveMutation.isPending}
                          >
                            <XCircle className="h-4 w-4" />
                            Reject Appeal
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white gap-2"
                            onClick={() => resolveMutation.mutate({ id: alarm.id, status: 'RESOLVED', type: alarm.type })}
                            disabled={resolveMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve Appeal
                          </Button>
                        </>
                      ) : alarm.status === 'RESOLVED' ? (
                        <div className="text-xs font-semibold text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200 flex items-center gap-1.5">
                          <CheckCircle className="h-3 w-3" />
                          {(() => {
                            // Find resolver in users list
                            const resolver = users.find(u => u.email === alarm.resolved_by);
                            if (resolver?.custom_role === 'owner' || resolver?.role === 'admin') {
                              return "Approved by Admin";
                            } else if (resolver?.custom_role === 'project_manager') {
                              return "User appeal is approved by Project Manager";
                            }
                            return "Appeal Approved";
                          })()}
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-100 flex items-center gap-1.5">
                          <Siren className="h-3 w-3 animate-pulse" />
                          User Blocked - Waiting for User Action/Appeal
                        </div>
                      )}
                    </div>
                  </div>

                  {(alarm.status === 'APPEALED' || (alarm.status === 'RESOLVED' && alarm.appeal_reason)) && (
                    <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100 italic relative">
                      <div className="absolute -top-3 left-4 bg-white px-2 text-xs font-semibold text-slate-500 flex items-center gap-1 border rounded-full border-slate-100 shadow-sm">
                        <MessageSquare className="h-3 w-3" />
                        Appeal Reason
                      </div>
                      <p className="text-slate-700">"{alarm.appeal_reason || "No reason provided."}"</p>
                    </div>
                  )}

                  {alarm.status === 'OPEN' && (
                    <div className="mt-4 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <strong>System Message:</strong> {alarm.message.replace(/\*\*/g, '')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

