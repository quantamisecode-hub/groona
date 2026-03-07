import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  MapPin,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  History,
  User,
  Users,
  CalendarCheck,
  Lock
} from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useRef, useEffect, useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";

export default function TimesheetList({
  timesheets,
  onEdit,
  onDelete,
  users = [],
  showActions = true,
  groupByDate = true,
  groupByEmployee = false, // Added groupByEmployee prop
  canEditLocked = false,
  currentUser, // Added currentUser prop
  highlightedId,
  effectiveTenantId // Added tenant id for fetches
}) {
  const itemRefs = useRef({});

  // 1. Fetch relevant projects to check status
  const projectIds = useMemo(() => {
    return [...new Set(timesheets.map(t => t.project_id).filter(Boolean))];
  }, [timesheets]);

  const { data: projectsMap = {} } = useQuery({
    queryKey: ['projects-lock-map', projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return {};
      const results = {};
      await Promise.all(projectIds.map(async pid => {
        let projects = await groonabackend.entities.Project.filter({ _id: pid });
        if (!projects || projects.length === 0) {
          projects = await groonabackend.entities.Project.filter({ id: pid });
        }
        if (projects[0]) results[pid] = projects[0];
      }));
      return results;
    },
    enabled: projectIds.length > 0,
    staleTime: 60000
  });

  // 2. Fetch relevant milestones to check status
  const milestoneIds = useMemo(() => {
    return [...new Set(timesheets.map(t => t.milestone_id).filter(Boolean))];
  }, [timesheets]);

  const { data: milestonesMap = {} } = useQuery({
    queryKey: ['milestones-lock-map', milestoneIds],
    queryFn: async () => {
      if (milestoneIds.length === 0) return {};
      const results = {};
      await Promise.all(milestoneIds.map(async mid => {
        const milestone = await groonabackend.entities.Milestone.get(mid);
        if (milestone) results[mid] = milestone;
      }));
      return results;
    },
    enabled: milestoneIds.length > 0,
    staleTime: 60000
  });

  // --- HIGHLIGHT & SCROLL LOGIC ---
  useEffect(() => {
    if (highlightedId && itemRefs.current[highlightedId]) {
      // Small Delay to ensure layout is finished
      const timeoutId = setTimeout(() => {
        itemRefs.current[highlightedId].scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        // Add a temporary ripple/highlight effect
        itemRefs.current[highlightedId].classList.add('ring-4', 'ring-blue-500', 'ring-offset-2', 'ring-opacity-50', 'animate-pulse');

        // Remove highlight after 3 seconds
        setTimeout(() => {
          if (itemRefs.current[highlightedId]) {
            itemRefs.current[highlightedId].classList.remove('ring-4', 'ring-blue-500', 'ring-offset-2', 'ring-opacity-50', 'animate-pulse');
          }
        }, 3000);
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [highlightedId, timesheets]);

  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    timesheetId: null,
    isApproved: false
  });
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
      case 'submitted': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'pending_pm': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'pending_admin': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'draft': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-3 w-3" />;
      case 'rejected': return <XCircle className="h-3 w-3" />;
      case 'submitted': return <AlertCircle className="h-3 w-3" />;
      case 'pending_pm': return <Clock className="h-3 w-3" />;
      case 'pending_admin': return <User className="h-3 w-3" />;
      case 'draft': return <FileText className="h-3 w-3" />;
      default: return <FileText className="h-3 w-3" />;
    }
  };

  const formatDuration = (hours, minutes) => {
    if (hours === 0 && minutes === 0) return '0h';
    if (minutes === 0) return `${hours}h`;
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  const groupedTimesheets = useMemo(() => {
    if (groupByDate && !groupByEmployee) {
      return timesheets.reduce((acc, entry) => {
        const date = entry.date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(entry);
        return acc;
      }, {});
    } else if (groupByEmployee) {
      return timesheets.reduce((acc, entry) => {
        const name = entry.user_name || entry.user_full_name || entry.user_email || 'Unknown Employee';
        if (!acc[name]) acc[name] = [];
        acc[name].push(entry);
        return acc;
      }, {});
    }
    return { all: timesheets };
  }, [timesheets, groupByDate, groupByEmployee]);

  if (timesheets.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
        <CardContent className="py-12 text-center">
          <Clock className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500">No timesheet entries found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedTimesheets).sort(([a], [b]) => b.localeCompare(a)).map(([groupKey, entries]) => (
        <div key={groupKey} className="space-y-3">
          {(groupByDate || groupByEmployee) && (
            <div className="flex items-center gap-2 text-slate-800 font-medium bg-slate-50/80 p-2.5 rounded-[12px] border border-slate-200/60 mb-1">
              {groupByEmployee ? <Users className="h-4 w-4 text-slate-500" /> : <Calendar className="h-4 w-4 text-slate-500" />}
              <span className="text-[13px] font-bold">{groupByEmployee ? groupKey : (() => {
                try {
                  return format(new Date(groupKey), 'EEEE, MMMM d, yyyy');
                } catch (e) {
                  return groupKey;
                }
              })()}</span>
              <div className="flex-1" />
              <span className="text-[12px] text-slate-500 font-medium">
                ({(entries.reduce((sum, e) => sum + (e.total_minutes || 0), 0) / 60).toFixed(2)}h total)
              </span>
            </div>
          )}

          {entries.map((entry) => (
            <Card
              key={entry.id}
              ref={el => itemRefs.current[entry.id || entry._id] = el}
              className={`bg-white border border-slate-200/60 rounded-[12px] shadow-sm hover:shadow-md transition-all duration-200 ${(highlightedId === entry.id || highlightedId === entry._id) ? 'ring-2 ring-blue-400' : ''
                }`}
            >
              <CardContent className="p-4 md:p-5">
                <div className="flex flex-col space-y-3">
                  {/* Top Row: Title, Badges, Hours, Actions */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center flex-wrap gap-2.5 flex-1">
                      <h4 className="font-bold text-[13px] text-slate-900 uppercase tracking-wide">
                        {entry.task_title || 'Untitled Task'}
                      </h4>

                      <Badge variant="outline" className={`px-2 py-0 h-6 text-[11px] rounded-full font-medium flex items-center gap-1.5 ${getStatusColor(entry.status)} bg-transparent`}>
                        {getStatusIcon(entry.status)}
                        <span className="capitalize">{entry.status === 'pending_pm' ? 'Pending PM' : entry.status.replace('pending_', 'Pending ').replace('_', ' ')}</span>
                      </Badge>

                      {entry.is_billable ? (
                        <Badge variant="outline" className="text-green-600 border-green-300 px-2 py-0 h-6 text-[11px] rounded-full font-medium bg-transparent">
                          Billable
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 border-red-200 px-2 py-0 h-6 text-[11px] rounded-full font-medium bg-transparent">
                          Non-Billable
                        </Badge>
                      )}

                      {/* User Name with Avatar */}
                      {entry.user_name && (() => {
                        const user = users.find(u => u.email === entry.user_email);
                        return (
                          <div className="flex items-center gap-1.5 px-2 py-0 h-6 bg-transparent rounded-full border border-slate-200 shadow-sm">
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={user?.profile_image_url} />
                              <AvatarFallback className="text-[8px] bg-slate-100 text-slate-600 font-medium border border-slate-200">
                                {entry.user_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[11px] font-bold text-slate-700">{entry.user_name}</span>
                          </div>
                        );
                      })()}

                      {/* PM Status Badge */}
                      {entry.status === 'pending_admin' && (
                        <Badge variant="outline" className={`gap-1.5 px-2 py-0 h-6 text-[10px] rounded-full font-bold uppercase tracking-wider bg-transparent ${entry.rejection_reason ? 'text-red-600 border-red-200' : 'text-green-600 border-green-300'}`}>
                          {entry.rejection_reason ? <XCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                          {entry.rejection_reason ? 'PM Recommended Rejection' : 'Accepted by PM'}
                        </Badge>
                      )}

                      {/* Settled Badge */}
                      {(() => {
                        const project = projectsMap[entry.project_id];
                        const milestone = entry.milestone_id ? milestonesMap[entry.milestone_id] : null;
                        const isSettled = (milestone?.status === 'completed') || (!entry.milestone_id && project?.status === 'completed');

                        if (isSettled) {
                          return (
                            <Badge variant="outline" className="text-slate-500 border-slate-200 bg-transparent text-[10px] font-bold uppercase tracking-wider px-2 py-0 h-6 gap-1.5">
                              <Lock className="h-3 w-3" />
                              Settled
                            </Badge>
                          );
                        }
                        return null;
                      })()}

                      {/* Edited Badge */}
                      {entry.last_modified_by_name && (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-transparent px-2 py-0 h-6 text-[10px] gap-1.5 font-medium">
                          <History className="h-3 w-3" />
                          Edited by {entry.last_modified_by_name}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex items-center gap-1.5 text-[15px] font-bold text-slate-900">
                        <Clock className="h-4 w-4 text-slate-700" />
                        {formatDuration(entry.hours, entry.minutes)}
                      </div>

                      {/* Actions */}
                      {(() => {
                        const project = projectsMap[entry.project_id];
                        const milestone = entry.milestone_id ? milestonesMap[entry.milestone_id] : null;
                        const isSettled = (milestone?.status === 'completed') || (!entry.milestone_id && project?.status === 'completed');

                        return showActions && (!entry.is_locked || canEditLocked) && !isSettled && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onEdit(entry)}
                              className="h-7 w-7 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                              title="Edit timesheet"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleteConfirmation({
                                  isOpen: true,
                                  timesheetId: entry.id,
                                  isApproved: entry.status === 'approved'
                                });
                              }}
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md"
                              title="Delete timesheet"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Second Row: Project Name & Timeline */}
                  <div className="text-[13px] text-slate-600 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-700">{entry.project_name}</span>
                    {entry.sprint_name && <span className="text-slate-400">• {entry.sprint_name}</span>}
                    {entry.start_time && entry.end_time && (() => {
                      try {
                        const userTimezone = currentUser?.timezone || 'Asia/Kolkata';
                        const zonedStart = toZonedTime(new Date(entry.start_time), userTimezone);
                        const zonedEnd = toZonedTime(new Date(entry.end_time), userTimezone);

                        return (
                          <span className="bg-slate-100 px-2 py-0.5 rounded-[6px] text-[12px] font-medium text-slate-600 ml-1">
                            {format(zonedStart, 'HH:mm')} - {format(zonedEnd, 'HH:mm')}
                          </span>
                        );
                      } catch (e) {
                        return null;
                      }
                    })()}
                  </div>

                  {/* Third Row: Description */}
                  {entry.description && (
                    <div className="text-[13px] text-slate-600 leading-relaxed mt-1">
                      {(() => {
                        const rawParts = entry.description.split(/(?=\b\d+\.)/);
                        const parts = rawParts.map(p => p.trim()).filter(Boolean);
                        const looksLikeList = parts.filter(p => /^\d+\./.test(p)).length > 0;

                        if (looksLikeList && parts.length > 1) {
                          return (
                            <div className="space-y-1 mt-0.5">
                              {parts.map((point, i) => {
                                const isPoint = /^\d+\./.test(point);
                                return (
                                  <div key={i} className={`flex items-start gap-1.5 ${isPoint ? 'pl-0' : 'mb-1'}`}>
                                    <span>{point}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }

                        return <p className="line-clamp-2">{entry.description}</p>;
                      })()}
                    </div>
                  )}

                  {/* Fourth Row: Location & Remark */}
                  {(entry.location || entry.remark || entry.status === 'rejected') && (
                    <div className="flex flex-col gap-2 mt-2">
                      {entry.location && (
                        <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">
                            {entry.location.address || `${entry.location.latitude}, ${entry.location.longitude}`}
                          </span>
                        </div>
                      )}

                      {entry.remark && (
                        <div className="p-2 bg-[#FFFDF0] border border-amber-100/50 rounded-lg text-[12px] text-amber-800">
                          <strong className="font-semibold italic text-amber-900 mr-1">Remark:</strong>
                          {entry.remark}
                        </div>
                      )}

                      {entry.status === 'rejected' && entry.rejection_reason && (
                        <div className="p-2 bg-red-50 border border-red-100 rounded-lg text-[12px] text-red-800">
                          <strong className="font-semibold text-red-900 mr-1">Rejection Reason:</strong>
                          {entry.rejection_reason}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fifth Row: Audit (Created Date etc) */}
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 mt-2">
                    <div className="flex items-center gap-1.5" title="Creation Date">
                      <Calendar className="h-3 w-3 opacity-60" />
                      <span className="font-medium">Created:</span>
                      <span>
                        {entry.created_date ? format(new Date(entry.created_date), 'MMM d, yyyy HH:mm') : 'N/A'}
                      </span>
                    </div>

                    {entry.last_modified_at && (
                      <div className="flex items-center gap-1.5" title="Last Modification">
                        <History className="h-3 w-3 opacity-60 text-amber-500" />
                        <span className="font-medium">Modified:</span>
                        <span>
                          {format(new Date(entry.last_modified_at), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                    )}

                    {entry.status === 'approved' && entry.approved_by && (
                      <div className="flex items-center gap-1.5" title="Approved By">
                        <CalendarCheck className="h-3 w-3 opacity-60 text-green-500" />
                        <span className="font-medium text-green-600">Approved By:</span>
                        <span className="text-slate-600 truncate max-w-[120px]">
                          {entry.approved_by}
                        </span>
                      </div>
                    )}
                  </div>

                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      <AlertDialog
        open={deleteConfirmation.isOpen}
        onOpenChange={(open) => setDeleteConfirmation(prev => ({ ...prev, isOpen: open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Timesheet Entry</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmation.isApproved
                ? "⚠️ This timesheet is approved. Deleting it may affect reports and billing. Are you sure you want to delete this entry?"
                : "Are you sure you want to delete this timesheet entry? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmation.timesheetId) {
                  onDelete(deleteConfirmation.timesheetId);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}