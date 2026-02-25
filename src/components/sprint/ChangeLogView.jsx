import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { 
  Clock, Edit2, Plus, Trash2, User, MessageSquarePlus, FileQuestion, 
  CheckCircle2, MoreHorizontal, Check, CheckCircle, XCircle 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const changeTypeConfig = {
  added: { label: "Added", color: "bg-green-100 text-green-700", icon: Plus },
  removed: { label: "Removed", color: "bg-red-100 text-red-700", icon: Trash2 },
  "re-estimated": { label: "Re-estimated", color: "bg-blue-100 text-blue-700", icon: Clock },
  "re-assigned": { label: "Re-assigned", color: "bg-purple-100 text-purple-700", icon: User },
  "status_change": { label: "Status Change", color: "bg-slate-100 text-slate-700", icon: Edit2 },
};

const statusStyles = {
  todo: "bg-slate-100 text-slate-700 border-slate-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  review: "bg-amber-100 text-amber-700 border-amber-200"
};

export default function ChangeLogView({ 
  logs = [], 
  requests = [], 
  isLocked = false, 
  onRequestChange,
  currentUser,
  onUpdateStatus 
}) {
  const hasContent = logs.length > 0 || requests.length > 0;
  
  // Logic for roles
  const isClient = currentUser?.custom_role === 'client' || currentUser?.role === 'client';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.is_super_admin || currentUser?.role === 'owner';

  if (!hasContent) {
    return (
      <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-lg flex flex-col items-center gap-4">
        {isLocked ? (
           <>
             <p>No changes recorded since the sprint scope was locked.</p>
             {isClient && (
               <Button onClick={onRequestChange} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                 <MessageSquarePlus className="h-4 w-4" />
                 Request Change
               </Button>
             )}
           </>
        ) : (
           <p>Changes will appear here once sprint scope is locked.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* 1. ACTIVE REQUESTS SECTION (Only show if locked or there are requests) */}
      {(isLocked || requests.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <FileQuestion className="h-4 w-4 text-blue-600" />
              Active Change Requests
            </h3>
            {/* Show Request Button ONLY if User is Client */}
            {isClient && (
              <Button size="sm" onClick={onRequestChange} className="gap-2 bg-blue-600 text-white shadow-sm">
                <MessageSquarePlus className="h-4 w-4" />
                New Request
              </Button>
            )}
          </div>

          <div className="border rounded-lg overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-[40%]">Request</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                  <TableHead className="text-right">Approved/Updated</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-6 text-slate-500 italic">
                      No active requests pending.
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-700">
                            {req.title.replace('Change Request: ', '')}
                          </span>
                          
                          <TooltipProvider>
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-slate-500 line-clamp-1 cursor-help hover:text-slate-800 transition-colors">
                                  {req.description}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[400px] p-3 break-words bg-slate-900 text-white border-slate-800">
                                <p className="text-sm font-normal leading-relaxed">{req.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                        </div>
                      </TableCell>
                      <TableCell>{req.reporter || 'Unknown'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${statusStyles[req.status] || statusStyles.todo} capitalize`}>
                          {req.status === 'todo' ? 'Received' : req.status === 'in_progress' ? 'In Progress' : req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-slate-500 text-xs">
                        {req.created_date ? format(new Date(req.created_date), 'MMM d, h:mm a') : '-'}
                      </TableCell>
                      <TableCell className="text-right text-slate-500 text-xs">
                        {req.updated_date && req.status !== 'todo' ? format(new Date(req.updated_date), 'MMM d, h:mm a') : '-'}
                      </TableCell>
                      
                      {/* Admin Actions Dropdown */}
                      {isAdmin && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                              <DropdownMenuItem 
                                onClick={() => onUpdateStatus(req.id, 'in_progress', req.title)}
                                className="gap-2 text-blue-700 focus:text-blue-800"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Approve (Start Work)
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => onUpdateStatus(req.id, 'completed', req.title)}
                                className="gap-2 text-green-700 focus:text-green-800"
                              >
                                <Check className="h-4 w-4" />
                                Mark as Done
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => onUpdateStatus(req.id, 'todo', req.title)}
                                className="gap-2"
                              >
                                <Clock className="h-4 w-4" />
                                Reset to Received
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      
    </div>
  );
}