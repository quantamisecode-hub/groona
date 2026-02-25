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
  CalendarCheck
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
import { useState, useRef, useEffect } from "react";

export default function TimesheetList({
  timesheets,
  onEdit,
  onDelete,
  users = [],
  showActions = true,
  groupByDate = true,
  canEditLocked = false,
  currentUser, // Added currentUser prop
  highlightedId
}) {
  const itemRefs = useRef({});

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

  const groupedTimesheets = groupByDate
    ? timesheets.reduce((acc, entry) => {
      const date = entry.date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(entry);
      return acc;
    }, {})
    : { all: timesheets };

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
      {Object.entries(groupedTimesheets).map(([date, entries]) => (
        <div key={date} className="space-y-3">
          {groupByDate && (
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <Calendar className="h-4 w-4" />
              {(() => {
                try {
                  return format(new Date(date), 'EEEE, MMMM d, yyyy');
                } catch (e) {
                  return date;
                }
              })()}
              <span className="text-sm text-slate-500 font-normal">
                ({(entries.reduce((sum, e) => sum + (e.total_minutes || 0), 0) / 60).toFixed(2)}h total)
              </span>
            </div>
          )}

          {entries.map((entry) => (
            <Card
              key={entry.id}
              ref={el => itemRefs.current[entry.id || entry._id] = el}
              className={`bg-white/80 backdrop-blur-xl border-slate-200/60 hover:shadow-md transition-all duration-500 ${(highlightedId === entry.id || highlightedId === entry._id) ? 'ring-2 ring-blue-400' : ''
                }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900">
                            {entry.task_title || 'Untitled Task'}
                          </h4>
                          <Badge className={getStatusColor(entry.status)}>
                            {getStatusIcon(entry.status)}
                            <span className="ml-1 capitalize">{entry.status === 'pending_pm' ? 'Pending PM' : entry.status.replace('pending_', 'Pending ').replace('_', ' ')}</span>
                          </Badge>
                          {entry.is_billable ? (
                            <Badge variant="outline" className="text-green-600 border-green-300">
                              Billable
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                              Non-Billable
                            </Badge>
                          )}
                          {/* Show User Name with Avatar */}
                          {entry.user_name && (() => {
                            const user = users.find(u => u.email === entry.user_email);
                            return (
                              <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-full border border-slate-200">
                                <Avatar className="h-6 w-6 ring-2 ring-slate-400 ring-offset-1">
                                  <AvatarImage src={user?.profile_image_url} />
                                  <AvatarFallback className="text-[10px] bg-white">
                                    {entry.user_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-bold text-slate-600">{entry.user_name}</span>
                              </div>
                            );
                          })()}

                          {/* PM Status Badge */}
                          {entry.status === 'pending_admin' && (
                            <Badge variant="outline" className={`gap-1 py-1 ${entry.rejection_reason ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                              {entry.rejection_reason ? <XCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                              <span className="text-[10px] font-bold uppercase tracking-wider">
                                {entry.rejection_reason ? 'PM Recommended Rejection' : 'Accepted by PM'}
                              </span>
                            </Badge>
                          )}
                          {/* Edited Badge */}
                          {entry.last_modified_by_name && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 gap-1">
                              <History className="h-3 w-3" />
                              Edited by {entry.last_modified_by_name}
                            </Badge>
                          )}
                        </div>

                        <div className="text-sm text-slate-600">
                          {entry.project_name}
                          {entry.sprint_name && ` • ${entry.sprint_name}`}
                          {entry.start_time && entry.end_time && (() => {
                            try {
                              const userTimezone = currentUser?.timezone || 'Asia/Kolkata';
                              // Convert UTC stored time to User's Timezone for display
                              const zonedStart = toZonedTime(new Date(entry.start_time), userTimezone);
                              const zonedEnd = toZonedTime(new Date(entry.end_time), userTimezone);

                              return (
                                <span className="ml-2 px-2 py-0.5 bg-slate-100 rounded text-xs" title={`Timezone: ${userTimezone}`}>
                                  {format(zonedStart, 'HH:mm')} - {format(zonedEnd, 'HH:mm')}
                                </span>
                              );
                            } catch (e) {
                              return null;
                            }
                          })()}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center gap-1 text-lg font-bold text-slate-900">
                          <Clock className="h-4 w-4" />
                          {formatDuration(entry.hours, entry.minutes)}
                        </div>
                      </div>
                    </div>

                    {entry.description && (
                      <div className="text-sm text-slate-600">
                        {(() => {
                          // Robust splitting: Look for point patterns like "1." or "2." 
                          // The lookahead (?=\b\d+\.) splits *before* the number, keeping the number in the next chunk.
                          // We accept "1.Text" (no space) and "1. Text" (space).
                          const rawParts = entry.description.split(/(?=\b\d+\.)/);

                          // Filter out completely empty strings/whitespace
                          const parts = rawParts.map(p => p.trim()).filter(Boolean);

                          // Heuristic: It's a list if we have at least 2 parts starting with numbers OR 1 part that starts with "1." and looks like a list item
                          // Actually, user wants "1. ... 2. ..." to become a list.
                          const looksLikeList = parts.filter(p => /^\d+\./.test(p)).length > 0;

                          if (looksLikeList && parts.length > 1) {
                            return (
                              <div className="space-y-1.5 mt-1">
                                {parts.map((point, i) => {
                                  // Check if this specific part starts with a number (it might be intro text)
                                  const isPoint = /^\d+\./.test(point);
                                  return (
                                    <div key={i} className={`flex items-start gap-1.5 ${isPoint ? 'pl-0' : 'mb-2'}`}>
                                      <span className="leading-relaxed">{point}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }

                          // Default render if not a list
                          return <p className="line-clamp-2">{entry.description}</p>;
                        })()}
                      </div>
                    )}

                    {entry.remark && (
                      <div className="mt-1 p-2 bg-amber-50 border border-amber-100 rounded text-xs text-amber-800 italic">
                        <strong>Remark:</strong> {entry.remark}
                      </div>
                    )}

                    {entry.location && (
                      <div className="flex items-start gap-2 text-xs text-slate-500">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">
                          {entry.location.address || `${entry.location.latitude}, ${entry.location.longitude}`}
                        </span>
                      </div>
                    )}

                    {entry.status === 'rejected' && entry.rejection_reason && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                        <strong>Rejection Reason:</strong> {entry.rejection_reason}
                      </div>
                    )}

                    {/* Unified Audit Section */}
                    <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-500">
                      {/* Created Date */}
                      <div className="flex items-center gap-1.5" title="Creation Date">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        <span className="font-medium">Created:</span>
                        <span>
                          {entry.created_date ? format(new Date(entry.created_date), 'MMM d, yyyy HH:mm') : 'N/A'}
                        </span>
                      </div>

                      {/* Modified Date */}
                      {entry.last_modified_at && (
                        <div className="flex items-center gap-1.5" title="Last Modification">
                          <History className="h-3 w-3 text-amber-400" />
                          <span className="font-medium">Modified:</span>
                          <span>
                            {format(new Date(entry.last_modified_at), 'MMM d, yyyy HH:mm')}
                          </span>
                        </div>
                      )}

                      {/* Approval Section */}
                      {entry.status === 'approved' && entry.approved_by && (
                        <div className="flex items-center gap-1.5" title="Approved By">
                          <CalendarCheck className="h-3 w-3 text-green-500" />
                          <span className="font-medium text-green-600">Approved By:</span>
                          <span className="text-slate-700 truncate max-w-[120px]">
                            {entry.approved_by}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Logic: Show only if allowed */}
                  {showActions && (!entry.is_locked || canEditLocked) && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(entry)}
                        className="h-8 w-8"
                        title="Edit timesheet"
                      >
                        <Edit className="h-4 w-4" />
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
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete timesheet"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
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