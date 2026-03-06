import React, { useState } from "react";
import { groonabackend, API_BASE } from "@/api/groonabackend";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/components/shared/UserContext";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Edit,
  Calendar as CalendarIcon,
  User as UserIcon,
  UserPlus,
  MoveRight,
  Link as LinkIcon,
  Paperclip,
  FileText,
  Loader2,
  CheckCircle2,
  Clock,
  Zap,
  Target,
  History,
  AlertCircle,
  Tag,
  ListTodo,
  CheckSquare,
  Square,
  Globe,
  ExternalLink,
  Check,
  Layout,
  Flag,
  Trash2,
  Siren,
  AlertTriangle,
  AlignLeft,
  Sparkles
} from "lucide-react";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import EditTaskDialog from "./EditTaskDialog";
import CommentsSection from "../project-detail/CommentsSection";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import DueDateActivityPanel from "./DueDateActivityPanel";

// --- Subtask Row Component ---
const SubtaskRow = ({ subtask, index, taskId, allUsers, onUpdate, onDelete, currentUser, project, reworkAlarms = [] }) => { // Added project and reworkAlarms props
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);

  const updateSubtask = async (updates) => {
    try {
      // Use the new dedicated backend endpoint
      const response = await fetch(`${API_BASE}/api/subtasks/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Assuming basic token auth - adjust if your auth system differs
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          taskId,
          subtaskIndex: index,
          updates,
          assignedBy: currentUser?.email,
          assignedByName: currentUser?.full_name,
          tenantId: currentUser?.active_tenant_id || currentUser?.tenant_id
        })
      });

      if (!response.ok) throw new Error('Failed to update subtask');

      const result = await response.json();
      if (result.success && result.task) {
        onUpdate(result.task);
        return true;
      }
      return false;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update subtask");
      return false;
    }
  };

  const handleDateSelect = async (date) => {
    if (!date) return;
    const success = await updateSubtask({ due_date: date.toISOString() });
    if (success) {
      toast.success("Due date set");
      setIsCalendarOpen(false);
    }
  };

  const handleAssignUser = async (email) => {
    // Check if user has high rework block
    const isBlocked = reworkAlarms.some(alarm => alarm.recipient_email === email);
    if (isBlocked && subtask.assigned_to !== email) {
      toast.error(`Cannot assign: ${email} has an active High Rework alarm.`);
      return;
    }

    // Implement toggle: if already assigned to this user, unassign
    const newAssignee = subtask.assigned_to === email ? null : email;
    const success = await updateSubtask({ assigned_to: newAssignee });

    if (success) {
      toast.success(newAssignee ? "User assigned" : "User unassigned");
      setIsAssignOpen(false);
    }
  };

  const assignedUser = allUsers.find(u => u.email === subtask.assigned_to);
  const isClient = currentUser?.custom_role === 'client';

  // Filter users for assignment: 
  // 1. Must be currently assigned OR
  // 2. Must be in project team AND not client/super_admin
  const projectTeamEmails = project?.team_members?.map(m => m.email) || [];

  // Filter users for assignment: Match CreateTaskModal logic
  // 1. Must be in same tenant
  // 2. Not super admin
  // 3. Not client
  // 4. Always include if already assigned
  const effectiveTenantId = currentUser?.active_tenant_id || currentUser?.tenant_id;

  const assignableUsers = allUsers.filter(user => {
    if (user.email === subtask.assigned_to) return true;

    // Strict tenant check
    if (user.tenant_id !== effectiveTenantId) return false;

    // Exclude super_admin (check both flag and role)
    if (user.is_super_admin || user.custom_role === 'super_admin') return false;

    // Exclude client
    if (user.custom_role === 'client') return false;

    // PROJECT TEAM FILTER: Only allow members of this project
    const isProjectMember = projectTeamEmails.includes(user.email);
    if (!isProjectMember) return false;

    return true;
  });

  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors group">
      <div className="mt-1">
        {subtask.completed ? (
          <CheckSquare
            className={cn(
              "h-5 w-5 text-emerald-500",
              isClient ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            )}
            onClick={() => !isClient && updateSubtask({ completed: false })}
          />
        ) : (
          <Square
            className={cn(
              "h-5 w-5 text-slate-300",
              isClient ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            )}
            onClick={() => !isClient && updateSubtask({ completed: true })}
          />
        )}
      </div>

      <div className="flex-1 flex flex-col">
        <span className={`text-sm font-medium ${subtask.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
          {subtask.title}
        </span>

        {/* Metadata Badges */}
        <div className="flex gap-2 mt-1 min-h-[20px]">
          {subtask.due_date && (
            <span className="text-[10px] text-red-600 flex items-center gap-1 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
              <CalendarIcon className="h-2.5 w-2.5" />
              {format(new Date(subtask.due_date), 'MMM d')}
            </span>
          )}
          {assignedUser && (
            <span className="text-[10px] text-indigo-600 flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
              <UserIcon className="h-2.5 w-2.5" />
              {assignedUser.full_name?.split(' ')[0] || assignedUser.email?.split('@')[0] || 'User'}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons - Hide for clients */}
      {!isClient && (
        <div className="flex items-center gap-1 transition-opacity mt-0.5">
          {/* 1. Due Date */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50", subtask.due_date && "text-indigo-600")}
                title="Set Due Date"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={subtask.due_date ? new Date(subtask.due_date) : undefined}
                onSelect={handleDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* 2. Assign User */}
          <Popover open={isAssignOpen} onOpenChange={setIsAssignOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50", subtask.assigned_to && "text-indigo-600")}
                title="Assign Member"
              >
                <UserPlus className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="end">
              <Command>
                <CommandInput placeholder="Search team..." />
                <CommandList>
                  <CommandEmpty>No members found.</CommandEmpty>
                  <CommandGroup>
                    {assignableUsers.map((user) => (
                      <CommandItem
                        key={user.email}
                        value={`${user.full_name} ${user.email}`} // Combine name and email for filtering
                        onSelect={() => handleAssignUser(user.email)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            subtask.assigned_to === user.email ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <Avatar className="h-6 w-6 mr-2">
                          <AvatarImage src={user.profile_image_url} />
                          <AvatarFallback>{(user.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="truncate flex-1">{user.full_name || user.email || 'Unknown User'}</span>
                        {reworkAlarms.some(alarm => alarm.recipient_email === user.email) && (
                          <Badge variant="outline" className="ml-auto text-[8px] border-red-200 bg-red-50 text-red-600 gap-1 animate-pulse">
                            <Siren className="h-2 w-2" />
                            FROZEN
                          </Badge>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* 3. Delete */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
            onClick={() => onDelete(index)}
            title="Delete Subtask"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

// --- Blocker Row Component ---
const BlockerRow = ({ blocker, index, currentTask, allUsers, onCurrentTaskUpdate, currentUser, project, reworkAlarms = [] }) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);

  const updateBlocker = async (updates) => {
    try {
      const newBlockedBy = [...(currentTask.blocked_by || [])];
      newBlockedBy[index] = { ...newBlockedBy[index], ...updates };
      const updatedTask = await groonabackend.entities.Task.update(currentTask.id || currentTask._id, { blocked_by: newBlockedBy });
      if (onCurrentTaskUpdate) onCurrentTaskUpdate(updatedTask);
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update blocker");
      return false;
    }
  };

  const handleDelete = async () => {
    try {
      const newBlockedBy = [...(currentTask.blocked_by || [])];
      newBlockedBy.splice(index, 1);
      const updatedTask = await groonabackend.entities.Task.update(currentTask.id || currentTask._id, { blocked_by: newBlockedBy });
      if (onCurrentTaskUpdate) onCurrentTaskUpdate(updatedTask);
      toast.success("Blocker deleted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete blocker");
    }
  };

  const handleDateSelect = async (date) => {
    if (!date) return;
    const success = await updateBlocker({ due_date: date.toISOString() });
    if (success) {
      toast.success("Due date set");
      setIsCalendarOpen(false);
    }
  };

  const handleAssignUser = async (email) => {
    const isBlocked = reworkAlarms.some(alarm => alarm.recipient_email === email);
    if (isBlocked && blocker.assigned_to !== email) {
      toast.error(`Cannot assign: ${email} has an active High Rework alarm.`);
      return;
    }

    const newAssignee = blocker.assigned_to === email ? null : email;
    const success = await updateBlocker({ assigned_to: newAssignee });

    if (success) {
      toast.success(newAssignee ? "User assigned" : "User unassigned");
      setIsAssignOpen(false);
    }
  };

  const assignedUser = allUsers.find(u => u.email === blocker.assigned_to);
  const isClient = currentUser?.custom_role === 'client';

  const projectTeamEmails = project?.team_members?.map(m => m.email) || [];
  const effectiveTenantId = currentUser?.active_tenant_id || currentUser?.tenant_id;

  const assignableUsers = allUsers.filter(user => {
    if (user.email === blocker.assigned_to) return true;
    if (user.tenant_id !== effectiveTenantId) return false;
    if (user.is_super_admin || user.custom_role === 'super_admin') return false;
    if (user.custom_role === 'client') return false;
    const isProjectMember = projectTeamEmails.includes(user.email);
    if (!isProjectMember) return false;
    return true;
  });

  return (
    <div className="flex items-start gap-3 p-3 bg-amber-50/50 rounded-lg border border-amber-100 hover:border-amber-200 transition-colors group shadow-sm">
      <div className="mt-1">
        {blocker.completed ? (
          <CheckSquare
            className={cn(
              "h-5 w-5 text-emerald-500",
              isClient ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            )}
            onClick={() => !isClient && updateBlocker({ completed: false })}
          />
        ) : (
          <Square
            className={cn(
              "h-5 w-5 text-amber-300 hover:text-amber-400",
              isClient ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            )}
            onClick={() => !isClient && updateBlocker({ completed: true })}
          />
        )}
      </div>

      <div className="flex-1 flex flex-col">
        <span className={`text-sm font-medium ${blocker.completed ? 'line-through text-slate-400' : 'text-amber-900'}`}>
          {blocker.title}
        </span>

        <div className="flex gap-2 mt-1 min-h-[20px]">
          {blocker.due_date && (
            <span className="text-[10px] text-red-600 flex items-center gap-1 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
              <CalendarIcon className="h-2.5 w-2.5" />
              {format(new Date(blocker.due_date), 'MMM d')}
            </span>
          )}
          {assignedUser && (
            <span className="text-[10px] text-indigo-600 flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
              <UserIcon className="h-2.5 w-2.5" />
              {assignedUser.full_name?.split(' ')[0] || assignedUser.email?.split('@')[0] || 'User'}
            </span>
          )}
        </div>
      </div>

      {!isClient && (
        <div className="flex items-center gap-1 transition-opacity mt-0.5">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50", blocker.due_date && "text-indigo-600")}
                title="Set Due Date"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={blocker.due_date ? new Date(blocker.due_date) : undefined}
                onSelect={handleDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Popover open={isAssignOpen} onOpenChange={setIsAssignOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50", blocker.assigned_to && "text-indigo-600")}
                title="Assign Member"
              >
                <UserPlus className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="end">
              <Command>
                <CommandInput placeholder="Search team..." />
                <CommandList>
                  <CommandEmpty>No members found.</CommandEmpty>
                  <CommandGroup>
                    {assignableUsers.map((user) => (
                      <CommandItem
                        key={user.email}
                        value={`${user.full_name} ${user.email}`}
                        onSelect={() => handleAssignUser(user.email)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            blocker.assigned_to === user.email ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <Avatar className="h-6 w-6 mr-2">
                          <AvatarImage src={user.profile_image_url} />
                          <AvatarFallback>{(user.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="truncate flex-1">{user.full_name || user.email || 'Unknown User'}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
            onClick={handleDelete}
            title="Delete Blocker"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

// --- Dependency Row Component ---
const DependencyRow = ({ dep, isCustom, currentTask, allUsers, onCurrentTaskUpdate, currentUser, project, reworkAlarms = [], queryClient }) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const isClient = currentUser?.custom_role === 'client';

  const handleDelete = async () => {
    try {
      const depIdentifier = isCustom ? dep : (dep.id || dep._id);
      const newDependencies = (currentTask.dependencies || []).filter(d => d !== depIdentifier);
      const updatedTask = await groonabackend.entities.Task.update(currentTask.id || currentTask._id, { dependencies: newDependencies });
      if (onCurrentTaskUpdate) onCurrentTaskUpdate(updatedTask);
      queryClient.invalidateQueries({ queryKey: ["related-tasks"] });
      toast.success("Dependency removed");
    } catch (e) {
      toast.error("Failed to remove dependency");
    }
  };

  const updateBlockingTask = async (updates) => {
    if (isCustom) return false;
    try {
      await groonabackend.entities.Task.update(dep.id || dep._id, updates);
      queryClient.invalidateQueries({ queryKey: ["related-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["sprint-tasks"] });
      return true;
    } catch (e) {
      toast.error("Failed to update blocking task");
      return false;
    }
  };

  const handleDateSelect = async (date) => {
    if (!date) return;
    const success = await updateBlockingTask({ due_date: date.toISOString() });
    if (success) {
      toast.success("Due date set for blocking task");
      setIsCalendarOpen(false);
    }
  };

  const handleAssignUser = async (email) => {
    const isBlocked = reworkAlarms.some(alarm => alarm.recipient_email === email);
    const assignedArray = Array.isArray(dep.assigned_to) ? dep.assigned_to : (dep.assigned_to ? [dep.assigned_to] : []);

    if (isBlocked && !assignedArray.includes(email)) {
      toast.error(`Cannot assign: ${email} has an active High Rework alarm.`);
      return;
    }

    let newAssignees = [...assignedArray];
    if (newAssignees.includes(email)) {
      newAssignees = newAssignees.filter(e => e !== email);
    } else {
      newAssignees.push(email);
    }

    const success = await updateBlockingTask({ assigned_to: newAssignees });
    if (success) {
      toast.success(newAssignees.includes(email) ? "User assigned" : "User unassigned");
      setIsAssignOpen(false);
    }
  };

  const assignedArray = !isCustom && Array.isArray(dep.assigned_to) ? dep.assigned_to : (!isCustom && dep.assigned_to ? [dep.assigned_to] : []);
  const firstAssigneeEmail = assignedArray[0];
  const assignedUser = firstAssigneeEmail ? allUsers.find(u => u.email === firstAssigneeEmail) : null;
  const projectTeamEmails = project?.team_members?.map(m => m.email) || [];
  const effectiveTenantId = currentUser?.active_tenant_id || currentUser?.tenant_id;
  const assignableUsers = allUsers.filter(user => {
    if (assignedArray.includes(user.email)) return true;
    if (user.tenant_id !== effectiveTenantId) return false;
    if (user.is_super_admin || user.custom_role === 'super_admin') return false;
    if (user.custom_role === 'client') return false;
    const isProjectMember = projectTeamEmails.includes(user.email);
    if (!isProjectMember) return false;
    return true;
  });

  return (
    <div className="flex items-start gap-3 p-3 bg-white border border-amber-200 hover:border-amber-300 transition-colors group rounded-lg shadow-sm">
      <div className="mt-1 flex items-center justify-center">
        {dep.status === 'completed' || dep.status === 'done' ? (
          <CheckSquare className="h-5 w-5 text-emerald-500" />
        ) : (
          <LinkIcon className="h-4 w-4 text-amber-500" />
        )}
      </div>

      <div className="flex-1 flex flex-col">
        <span className={`text-sm font-medium ${dep.status === 'completed' || dep.status === 'done' ? 'line-through text-slate-400' : 'text-amber-900'}`}>
          {isCustom ? dep : dep.title}
        </span>

        {!isCustom && (
          <div className="flex gap-2 mt-1 min-h-[20px]">
            {dep.due_date && (
              <span className="text-[10px] text-red-600 flex items-center gap-1 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                <CalendarIcon className="h-2.5 w-2.5" />
                {format(new Date(dep.due_date), 'MMM d')}
              </span>
            )}
            {assignedUser && (
              <span className="text-[10px] text-indigo-600 flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                <UserIcon className="h-2.5 w-2.5" />
                {assignedUser.full_name?.split(' ')[0] || assignedUser.email?.split('@')[0] || 'User'}
                {assignedArray.length > 1 && ` (+${assignedArray.length - 1})`}
              </span>
            )}
            {dep.status && (
              <span className="text-[10px] text-slate-600 flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                {dep.status.replace('_', ' ').toUpperCase()}
              </span>
            )}
          </div>
        )}
      </div>

      {!isClient && (
        <div className="flex items-center gap-1 transition-opacity mt-0.5">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50", !isCustom && dep.due_date && "text-indigo-600")}
                title="Set Due Date"
                disabled={isCustom}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            {!isCustom && (
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dep.due_date ? new Date(dep.due_date) : undefined}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            )}
          </Popover>

          <Popover open={isAssignOpen} onOpenChange={setIsAssignOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50", !isCustom && assignedUser && "text-indigo-600")}
                title="Assign Member"
                disabled={isCustom}
              >
                <UserPlus className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            {!isCustom && (
              <PopoverContent className="p-0" align="end">
                <Command>
                  <CommandInput placeholder="Search team..." />
                  <CommandList>
                    <CommandEmpty>No members found.</CommandEmpty>
                    <CommandGroup>
                      {assignableUsers.map((user) => (
                        <CommandItem
                          key={user.email}
                          value={`${user.full_name} ${user.email}`}
                          onSelect={() => handleAssignUser(user.email)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              assignedArray.includes(user.email) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <Avatar className="h-6 w-6 mr-2">
                            <AvatarImage src={user.profile_image_url} />
                            <AvatarFallback>{(user.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="truncate flex-1">{user.full_name || user.email || 'Unknown User'}</span>
                          {reworkAlarms.some(alarm => alarm.recipient_email === user.email) && (
                            <Badge variant="outline" className="ml-auto text-[8px] border-red-200 bg-red-50 text-red-600 gap-1 animate-pulse">
                              <Siren className="h-2 w-2" />
                              FROZEN
                            </Badge>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            )}
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
            onClick={handleDelete}
            title="Remove Dependency"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default function TaskDetailDialog({ open, onClose, taskId, initialTask, highlightCommentId, readOnly = false, onTaskUpdate }) {
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { user: currentUser } = useUser();
  const [showImpedimentDialog, setShowImpedimentDialog] = useState(false);
  const [impedimentData, setImpedimentData] = useState({
    title: "",
    description: "",
    severity: "medium",
  });
  const [selectedImpedimentId, setSelectedImpedimentId] = useState("new");
  const [isReporting, setIsReporting] = useState(false);


  const handleReportImpediment = async () => {
    setIsReporting(true);
    try {
      if (selectedImpedimentId && selectedImpedimentId !== "new") {
        // Link to existing impediment
        await groonabackend.entities.Impediment.update(selectedImpedimentId, {
          task_id: task?.id || task?._id,
        });
        toast.success('Task linked to impediment successfully!');
      } else {
        // Create new impediment
        if (!impedimentData.title.trim()) {
          toast.error('Impediment title is required');
          setIsReporting(false);
          return;
        }

        const impedimentPayload = {
          tenant_id: currentUser?.active_tenant_id || currentUser?.tenant_id,
          workspace_id: project?.workspace_id || "",
          project_id: task?.project_id,
          sprint_id: task?.sprint_id,
          story_id: task?.story_id,
          task_id: task?.id || task?._id,
          title: impedimentData.title.trim(),
          description: impedimentData.description || "",
          severity: impedimentData.severity,
          status: "open",
          reported_by: currentUser?.email,
          reported_by_name: currentUser?.full_name || currentUser?.email,
        };

        await groonabackend.entities.Impediment.create(impedimentPayload);
        toast.success('Impediment reported successfully!');
      }

      // Reset and close
      setImpedimentData({ title: "", description: "", severity: "medium" });
      setSelectedImpedimentId("new");
      setShowImpedimentDialog(false);

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['impediments', task?.project_id] });
    } catch (error) {
      console.error('Error reporting impediment:', error);
      toast.error('Failed to report impediment');
    } finally {
      setIsReporting(false);
    }
  };

  // Check if user is a viewer
  const isViewer = currentUser?.custom_role === 'viewer';

  const { data: task, isLoading } = useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      let tasks = await groonabackend.entities.Task.filter({ _id: taskId });
      if (!tasks || tasks.length === 0) {
        tasks = await groonabackend.entities.Task.filter({ id: taskId });
      }
      return tasks[0] || null;
    },
    enabled: !!taskId,
    initialData: initialTask,
    staleTime: initialTask ? 60 * 1000 : 0,
  });

  const { data: projectImpediments = [] } = useQuery({
    queryKey: ['impediments', task?.project_id],
    queryFn: async () => {
      if (!task?.project_id) return [];
      return await groonabackend.entities.Impediment.filter({ project_id: task.project_id });
    },
    enabled: !!task?.project_id && showImpedimentDialog,
  });

  const { data: project } = useQuery({
    queryKey: ["project", task?.project_id],
    queryFn: async () => {
      if (!task?.project_id) return null;
      let projects = await groonabackend.entities.Project.filter({ _id: task.project_id });
      if (!projects || projects.length === 0) {
        projects = await groonabackend.entities.Project.filter({ id: task.project_id });
      }
      return projects[0] || null;
    },
    enabled: !!task?.project_id,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => groonabackend.entities.User.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: reworkAlarms = [] } = useQuery({
    queryKey: ['rework-alarms', currentUser?.tenant_id],
    queryFn: async () => {
      const tid = currentUser?.active_tenant_id || currentUser?.tenant_id;
      if (!tid) return [];
      return await groonabackend.entities.Notification.filter({
        tenant_id: tid,
        type: 'high_rework_alarm',
        status: 'OPEN'
      });
    },
    enabled: open && !!currentUser,
    refetchInterval: 30000,
  });





  const { data: assignees = [] } = useQuery({
    queryKey: ["task-assignees", task?.assigned_to],
    queryFn: async () => {
      if (!task?.assigned_to || task.assigned_to.length === 0) return [];
      if (allUsers.length > 0) {
        return allUsers.filter(u => task.assigned_to.includes(u.email));
      }
      const users = await groonabackend.entities.User.list();
      return users.filter(u => task.assigned_to.includes(u.email));
    },
    enabled: !!task?.assigned_to && task.assigned_to.length > 0,
  });

  const { data: relatedTasks = [] } = useQuery({
    queryKey: ["related-tasks", task?.dependencies, task?.project_id],
    queryFn: async () => {
      if (!task?.dependencies || task.dependencies.length === 0) return [];
      const tasks = await groonabackend.entities.Task.filter({ project_id: task.project_id });
      return tasks.filter(t => task.dependencies.includes(t.id) || task.dependencies.includes(t.title));
    },
    enabled: !!task?.dependencies && task.dependencies.length > 0,
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: () => groonabackend.entities.Comment.filter({
      entity_type: 'task',
      entity_id: taskId
    }, '-created_date'),
    enabled: !!taskId,
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ['project-sprints', task?.project_id],
    queryFn: async () => {
      if (!task?.project_id) return [];
      return await groonabackend.entities.Sprint.filter({ project_id: task.project_id });
    },
    enabled: !!task?.project_id,
  });

  const getStatusConfig = (status) => {
    const configs = {
      todo: {
        gradient: "from-slate-500 to-slate-600",
        label: "To Do",
        icon: Clock
      },
      in_progress: {
        gradient: "from-blue-500 to-blue-600",
        label: "In Progress",
        icon: Zap
      },
      review: {
        gradient: "from-amber-500 to-orange-600",
        label: "Review",
        icon: Target
      },
      completed: {
        gradient: "from-emerald-500 to-green-600",
        label: "Completed",
        icon: CheckCircle2
      },
    };
    return configs[status] || configs.todo;
  };

  const getPriorityConfig = (priority) => {
    const configs = {
      low: { gradient: "from-blue-400 to-blue-500" },
      medium: { gradient: "from-amber-400 to-amber-500" },
      high: { gradient: "from-orange-400 to-orange-500" },
      urgent: { gradient: "from-red-400 to-red-500" },
    };
    return configs[priority] || configs.medium;
  };

  const getTaskTypeConfig = (type) => {
    const configs = {
      story: { icon: "📖" },
      bug: { icon: "🐛" },
      task: { icon: "✓" },
      epic: { icon: "⭐" },
      technical_debt: { icon: "🔧" },
    };
    return configs[type] || configs.task;
  };

  const handleEditClick = () => setShowEditDialog(true);

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const handleTaskUpdateFromEdit = (updatedTask) => {
    if (updatedTask && taskId) {
      queryClient.setQueryData(["task-detail", taskId], updatedTask);
    }
    queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
    if (onTaskUpdate) onTaskUpdate(updatedTask);
  };

  const handleSprintChange = async (newSprintId) => {
    if (!task) return;
    try {
      const finalId = newSprintId === "unassigned" ? null : newSprintId;
      const updated = await groonabackend.entities.Task.update(task.id || task._id, { sprint_id: finalId });
      handleTaskUpdateFromEdit(updated);
      toast.success(finalId ? "Sprint updated" : "Moved to backlog");
    } catch (error) {
      toast.error("Failed to update sprint");
    }
  };

  const handleDeleteSubtask = async (index) => {
    if (!task) return;
    try {
      const newSubtasks = [...(task.subtasks || [])];
      newSubtasks.splice(index, 1);

      const updated = await groonabackend.entities.Task.update(task.id, { subtasks: newSubtasks });
      handleTaskUpdateFromEdit(updated);
      toast.success("Subtask deleted");
    } catch (error) {
      console.error("Failed to delete subtask:", error);
      toast.error("Failed to delete subtask");
    }
  };

  const renderDescription = (text) => {
    if (!text) return <p className="text-sm text-slate-400 italic">No description provided.</p>;

    // Extended Plain Text Rendering with Keyword Highlighting
    // Strict Keyword Highlighting for specific headers
    const pattern = /(OVERVIEW|KEY REQUIREMENTS|SCOPE)/g;

    // Check if text matches our specific keywords
    if (pattern.test(text)) {
      // Clean HTML tags first to handle mixed content from rich text editors
      const cleanText = text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]+>/g, '') // Strip remaining tags
        .replace(/&nbsp;/g, ' ');

      const parts = cleanText.split(pattern);

      return (
        <div className="text-sm text-slate-700 leading-relaxed">
          {parts.map((part, index) => {
            if (!part) return null;
            // Check if this part is one of our keywords
            if (part.match(/^(OVERVIEW|KEY REQUIREMENTS|SCOPE)$/)) {
              return (
                <div key={index} className="font-bold text-slate-800 mt-6 mb-2 block tracking-tight bg-yellow-100 px-2 py-1 border-l-4 border-yellow-500 rounded-sm w-fit uppercase">
                  {part}
                </div>
              );
            }
            // Regular text content
            const trimmed = part.trim();
            if (!trimmed) return null;

            return (
              <div key={index} className="mb-4 whitespace-pre-wrap">
                {trimmed}
              </div>
            );
          })}
        </div>
      );
    }

    // Check if text contains HTML tags
    const hasHTML = /<[^>]+>/.test(text);

    if (hasHTML) {
      return (
        <div
          className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-ul:text-slate-700 prose-ol:text-slate-700 prose-li:text-slate-700 prose-ul:list-disc prose-ol:list-decimal prose-ul:pl-5 prose-ol:pl-5"
          dangerouslySetInnerHTML={{ __html: text }}
        />
      );
    }

    // Fallback standard text
    return text.split('\n').map((line, index) => {
      const trimmed = line.trim();
      const isHeader = trimmed.length > 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);

      if (isHeader) {
        return (
          <div key={index} className="text-sm font-bold text-slate-900 mt-4 mb-1 tracking-wide">
            {line}
          </div>
        );
      }
      if (trimmed === "") {
        return <div key={index} className="h-2" />;
      }
      return (
        <div key={index} className="text-sm text-slate-700 leading-relaxed">
          {line}
        </div>
      );
    });
  };

  const renderAcceptanceCriteria = (text) => {
    if (!text) return null;

    // Check if text contains HTML tags
    const hasHTML = /<[^>]+>/.test(text);

    if (hasHTML) {
      // Render HTML content safely with proper styling
      return (
        <div
          className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-ul:text-slate-700 prose-ol:text-slate-700 prose-li:text-slate-700 prose-ul:list-disc prose-ol:list-decimal prose-ul:pl-5 prose-ol:pl-5"
          dangerouslySetInnerHTML={{ __html: text }}
        />
      );
    }

    // Fallback to plain text rendering for non-HTML content
    // Split by newlines and render each line with a checkmark
    return (
      <div className="text-sm text-slate-700 space-y-3">
        {text.split('\n').map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          return (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-1 h-4 w-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Check className="h-2.5 w-2.5 text-green-600" />
              </div>
              <span className="flex-1 leading-relaxed">{trimmed.replace(/^- /, '')}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading && !task) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl" aria-describedby="loading-desc">
          <DialogTitle className="sr-only">Loading Task</DialogTitle>
          <DialogDescription id="loading-desc" className="sr-only">
            Please wait while the task details are being loaded.
          </DialogDescription>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <p className="text-slate-600 font-medium mt-6">Loading task details...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!task) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent aria-describedby="error-desc">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-10 w-10 text-slate-400 mb-3" />
            <DialogTitle>Task not found</DialogTitle>
            <DialogDescription id="error-desc" className="text-slate-500 mt-2">
              This task may have been deleted.
            </DialogDescription>
            <Button variant="outline" onClick={onClose} className="mt-4">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const statusConfig = getStatusConfig(task.status);
  const priorityConfig = getPriorityConfig(task.priority);
  const typeConfig = getTaskTypeConfig(task.task_type);
  const StatusIcon = statusConfig.icon;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto p-0 gap-0 border border-slate-200/50 shadow-2xl rounded-2xl bg-white" aria-describedby="task-desc">
          <DialogDescription id="task-desc" className="sr-only">
            Detailed view of task {task.title} including status, subtasks, and comments.
          </DialogDescription>

          {/* Header */}
          <div className="p-8 pb-6 bg-white flex-shrink-0 relative border-b border-slate-100">
            <div className="flex items-start gap-5 mb-5 pr-10">
              <div className="flex-1 pt-1">
                <DialogTitle className="text-[26px] font-bold text-slate-900 leading-tight mb-2 tracking-tight">
                  {task.title}
                </DialogTitle>
                <div className="flex items-center gap-4">
                  <p className="text-slate-500 text-[14px] font-medium flex items-center gap-1.5 leading-none">
                    {project?.name || 'Project'}
                  </p>

                </div>
              </div>
              {!readOnly && !isViewer && (
                <Button
                  onClick={handleEditClick}
                  size="sm"
                  variant="outline"
                  className="text-slate-600 border-slate-200 hover:bg-slate-50 h-9 font-medium shadow-none transition-colors rounded-full px-5"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full text-[13px] font-semibold text-slate-700">
                <StatusIcon className="h-4 w-4 text-slate-500" />
                {statusConfig.label}
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full text-[13px] font-semibold text-slate-700">
                <Flag className="h-4 w-4 text-slate-500" />
                {task.priority.toUpperCase()}
              </div>
              {task.story_points > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full text-[13px] font-semibold text-slate-700">
                  {task.story_points} Points
                </div>
              )}
            </div>
          </div>

          <div className="p-8 bg-white">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* LEFT COLUMN: Main Content + Comments */}
              <div className="lg:col-span-2 space-y-6">

                {/* Description - Highlighted Headers */}
                <div className="bg-white pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-[19px] font-bold text-slate-900 tracking-tight">Description</h3>
                  </div>
                  <div className="text-[15px] text-slate-700 leading-relaxed max-w-none prose prose-slate">
                    {renderDescription(task.description)}
                  </div>
                </div>

                {/* Reference URL */}
                {task.reference_url && (
                  <div className="bg-slate-50/50 border border-slate-100 p-4 flex items-center gap-4 rounded-2xl">
                    <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm border border-slate-100">
                      <Globe className="h-5 w-5 text-slate-500" />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reference Link</h3>
                      <a
                        href={task.reference_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[15px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1.5 truncate"
                      >
                        {task.reference_url} <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Subtasks - UPDATED WITH ACTION BUTTONS */}
                {task.subtasks && task.subtasks.length > 0 && (
                  <div className="bg-white py-6 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <h3 className="text-[19px] font-bold text-slate-900 tracking-tight">Subtasks</h3>
                      </div>
                      <span className="text-slate-400 text-sm font-medium">
                        {task.subtasks.filter(st => st.completed).length} of {task.subtasks.length}
                      </span>
                    </div>
                    <div className="space-y-0 text-[15px]">
                      {task.subtasks.map((subtask, idx) => (
                        <div key={idx} className="border-b border-slate-100 last:border-0 py-1">
                          <SubtaskRow
                            subtask={subtask}
                            index={idx}
                            taskId={task.id}
                            allUsers={allUsers}
                            onUpdate={handleTaskUpdateFromEdit}
                            onDelete={handleDeleteSubtask}
                            currentUser={currentUser}
                            project={project}
                            reworkAlarms={reworkAlarms}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Blocked By (Dependencies) */}
                {((task.dependencies && task.dependencies.length > 0) || (task.blocked_by && task.blocked_by.length > 0) || relatedTasks.length > 0) && (
                  <div className="bg-white py-6 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <h3 className="text-[19px] font-bold text-slate-900 tracking-tight">Blocked By</h3>
                      </div>
                    </div>
                    <div className="space-y-0 text-[15px]">
                      {/* New Standalone Blockers */}
                      {task.blocked_by?.map((blocker, index) => (
                        <div key={`blocker-${index}`} className="border-b border-slate-100 last:border-0 py-1">
                          <BlockerRow
                            blocker={blocker}
                            index={index}
                            currentTask={task}
                            allUsers={allUsers}
                            onCurrentTaskUpdate={handleTaskUpdateFromEdit}
                            currentUser={currentUser}
                            project={project}
                            reworkAlarms={reworkAlarms}
                          />
                        </div>
                      ))}

                      {/* Legacy Linked Dependencies */}
                      {relatedTasks.map((depTask) => (
                        <div key={depTask.id} className="border-b border-slate-100 last:border-0 py-1">
                          <DependencyRow
                            dep={depTask}
                            isCustom={false}
                            currentTask={task}
                            allUsers={allUsers}
                            onCurrentTaskUpdate={handleTaskUpdateFromEdit}
                            currentUser={currentUser}
                            project={project}
                            reworkAlarms={reworkAlarms}
                            queryClient={queryClient}
                          />
                        </div>
                      ))}
                      {task.dependencies && task.dependencies
                        .filter(depId => !relatedTasks.some(rt => rt.id === depId))
                        .map((customDep, index) => (
                          <div key={`custom-${index}`} className="border-b border-slate-100 last:border-0 py-1">
                            <DependencyRow
                              dep={customDep}
                              isCustom={true}
                              currentTask={task}
                              allUsers={allUsers}
                              onCurrentTaskUpdate={handleTaskUpdateFromEdit}
                              currentUser={currentUser}
                              project={project}
                              reworkAlarms={reworkAlarms}
                              queryClient={queryClient}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Comments Section */}
                <div className="pt-2">
                  <CommentsSection
                    comments={comments}
                    users={allUsers}
                    mentionableUsers={allUsers.filter(u => project?.team_members?.some(m => m.email === u.email))}
                    entityType="task"
                    entityId={taskId}
                    entityName={task.title}
                    currentUser={currentUser}
                    loading={commentsLoading}
                    highlightCommentId={highlightCommentId}
                  />
                </div>

              </div>

              {/* RIGHT COLUMN: Sidebar (Timeline, Labels, etc.) */}
              <div className="space-y-6">

                {/* Timeline & Assigned To */}
                <div className="bg-white">
                  <div className="py-2">
                    <h3 className="text-[19px] font-bold text-slate-900 tracking-tight mb-5">Details</h3>

                    {/* Dates */}
                    <div className="space-y-4 mb-8">
                      <div>
                        <p className="text-[13px] text-slate-500 font-medium mb-1">Due Date</p>
                        <p className="text-[15px] font-semibold text-slate-900">
                          {task.due_date ? format(parseISO(task.due_date), "MMM d, yyyy") : "None"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[13px] text-slate-500 font-medium mb-1">Estimate</p>
                        <p className="text-[15px] font-semibold text-slate-900">
                          {task.estimated_hours || 0} hrs
                        </p>
                      </div>

                      <div className="pt-2">
                        <p className="text-[13px] text-slate-500 font-medium mb-2">Sprint</p>
                        <Select
                          value={task.sprint_id || "unassigned"}
                          onValueChange={handleSprintChange}
                          disabled={readOnly || isViewer}
                        >
                          <SelectTrigger className="h-9 text-[14px] font-medium border-slate-200">
                            <SelectValue placeholder="Select Sprint" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">No Sprint (Backlog)</SelectItem>
                            {sprints
                              .filter(s => {
                                const isAdmin = currentUser?.is_super_admin || currentUser?.custom_role === 'admin';
                                if (isAdmin) return true;
                                return s.status !== 'completed' || s.id === task.sprint_id;
                              })
                              .map(sprint => (
                                <SelectItem key={sprint.id || sprint._id} value={sprint.id || sprint._id}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${sprint.status === 'active' ? 'bg-green-500' :
                                      sprint.status === 'completed' ? 'bg-slate-300' : 'bg-slate-300'
                                      }`} />
                                    {sprint.name}
                                    {sprint.status === 'active' && <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px] ml-2">Active</Badge>}
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Assigned To - Vertical List */}
                    <div>
                      <div className="mb-3">
                        <span className="text-[13px] text-slate-500 font-medium">Assigned To</span>
                      </div>

                      {assignees.length > 0 ? (
                        <div className="flex flex-col gap-3">
                          {assignees.map((assignee) => (
                            <div
                              key={assignee.id}
                              className="flex items-center gap-3 group cursor-default"
                            >
                              <Avatar className="h-8 w-8 bg-slate-100 flex items-center justify-center text-slate-700">
                                <AvatarImage src={assignee.profile_image_url} />
                                <AvatarFallback className="text-[11px] bg-slate-100 text-slate-700 font-medium">
                                  {(assignee.full_name?.substring(0, 2) || assignee.email?.substring(0, 2) || 'U').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-[15px] font-semibold text-slate-900 truncate">{assignee.full_name || assignee.email || 'Unknown User'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-left py-2">
                          <span className="text-[15px] text-slate-400 font-medium">Unassigned</span>
                        </div>
                      )}
                    </div>

                    {/* Report Impediment Button - Only if Overdue >= 2 Days */}
                    {task.due_date && (() => {
                      const today = new Date();
                      const dueDate = parseISO(task.due_date);
                      // Calculate difference: today - dueDate. Positive means overdue.
                      const diff = differenceInDays(today, dueDate);

                      if (diff >= 2) {
                        return (
                          <div className="pt-8">
                            <Button
                              onClick={() => setShowImpedimentDialog(true)}
                              size="sm"
                              className="w-full bg-red-50 hover:bg-red-100 text-red-600 border-0 shadow-none hover:shadow-none font-semibold rounded-xl h-10 transition-colors"
                            >
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Report Impediment
                            </Button>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                {/* Due Date Activity - MOVED UP */}
                <div className="bg-white py-2">
                  <DueDateActivityPanel taskId={task?.id || task?._id} />
                </div>

                {/* AI Priority Suggestions (Only if Overdue) */}
                {task.due_date && differenceInDays(new Date(), parseISO(task.due_date)) >= 1 && (
                  <Card className="border-red-200 shadow-sm bg-red-50/50">
                    <div className="bg-red-100 p-3 border-b border-red-200 flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center animate-pulse">
                        <Siren className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-sm font-bold text-red-900">Action Required</span>
                    </div>
                    <CardContent className="p-4 space-y-4">
                      <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                        <p className="text-xs font-bold text-red-800 mb-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Overdue Alert
                        </p>
                        <p className="text-sm text-slate-700 leading-snug">
                          This task is overdue. System recommends immediate reprioritization.
                          <span className="block font-semibold mt-1 text-red-700">Please meet with your Project Manager.</span>
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">AI Suggestions</p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-slate-700 bg-white p-2 rounded border border-slate-100">
                            <MoveRight className="h-3 w-3 text-blue-500" />
                            <span>Change Priority to <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-none ml-1">Urgent</Badge></span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-700 bg-white p-2 rounded border border-slate-100">
                            <MoveRight className="h-3 w-3 text-blue-500" />
                            <span>Extend Due Date to <strong>{format(addDays(new Date(), 3), "MMM d")}</strong></span>
                          </div>
                          {(task.story_points > 5 || !task.story_points) && (
                            <div className="flex items-center gap-2 text-sm text-slate-700 bg-white p-2 rounded border border-slate-100">
                              <MoveRight className="h-3 w-3 text-blue-500" />
                              <span>Review <span className="font-semibold">Story Points</span> (High Complexity)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Labels - Vertical Step-wise */}
                {task.labels && task.labels.length > 0 && (
                  <div className="bg-white py-2">
                    <h3 className="text-[19px] font-bold text-slate-900 tracking-tight mb-4">Labels</h3>
                    <div className="flex flex-col items-start gap-2">
                      {task.labels.map((label, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100/60 text-[13px] font-semibold text-slate-700 w-fit hover:bg-slate-100 transition-colors"
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Acceptance Criteria */}
                {task.acceptance_criteria && (
                  <div className="bg-white py-2">
                    <h3 className="text-[19px] font-bold text-slate-900 tracking-tight mb-4">Acceptance Criteria</h3>
                    <div className="text-[15px] text-slate-700 leading-relaxed max-w-none prose prose-slate pl-2 border-l-2 border-indigo-100">
                      {renderAcceptanceCriteria(task.acceptance_criteria)}
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {task.attachments && task.attachments.length > 0 && (
                  <div className="bg-white py-2">
                    <h3 className="text-[19px] font-bold text-slate-900 tracking-tight mb-4">Attachments</h3>
                    <div className="space-y-3">
                      {task.attachments.map((file, index) => (
                        <a
                          key={index}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-4 p-3 bg-slate-50/50 border border-slate-100/80 rounded-2xl hover:bg-slate-50 hover:border-slate-200 transition-all group"
                        >
                          <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 text-slate-400 border border-slate-100 shadow-sm group-hover:text-indigo-600 transition-colors">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
                              {file.name}
                            </p>
                            <p className="text-[11px] text-slate-400 uppercase font-medium mt-0.5">
                              {file.name.split('.').pop() || 'FILE'}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Impediment Dialog */}
      <Dialog open={showImpedimentDialog} onOpenChange={setShowImpedimentDialog}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex flex-col gap-0 mb-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Report Impediment
            </DialogTitle>
            <DialogDescription>
              This impediment will be directly linked to task <span className="font-medium text-slate-900">{task?.title}</span>.
            </DialogDescription>
          </div>

          <div className="space-y-4 bg-red-50 border border-red-200 rounded-lg p-4">

            {/* Link to Existing / Create New */}
            <div>
              <label className="text-sm font-semibold text-red-900 flex items-center gap-1.5 mb-1.5">
                <LinkIcon className="h-3.5 w-3.5" />
                Link to Existing Impediment
              </label>
              <Select
                value={selectedImpedimentId}
                onValueChange={setSelectedImpedimentId}
              >
                <SelectTrigger className="bg-white border-red-200 focus:ring-red-500">
                  <SelectValue placeholder="Select existing impediment or create new" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Create New Impediment</SelectItem>
                  {projectImpediments
                    .filter(imp => imp.status !== 'resolved')
                    .map(impediment => (
                      <SelectItem key={impediment.id || impediment._id} value={impediment.id || impediment._id}>
                        {impediment.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {selectedImpedimentId === "new" ? (
              <>
                <div>
                  <label htmlFor="impediment-title" className="text-sm font-semibold text-red-900 flex items-center gap-1.5 mb-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Impediment Title *
                  </label>
                  <input
                    id="impediment-title"
                    value={impedimentData.title}
                    onChange={(e) => setImpedimentData({ ...impedimentData, title: e.target.value })}
                    placeholder="Brief description of the impediment"
                    className="flex h-10 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div>
                  <label htmlFor="impediment-description" className="text-sm font-semibold text-red-900 flex items-center gap-1.5 mb-1.5">
                    <AlignLeft className="h-3.5 w-3.5" />
                    Description
                  </label>
                  <textarea
                    id="impediment-description"
                    value={impedimentData.description}
                    onChange={(e) => setImpedimentData({ ...impedimentData, description: e.target.value })}
                    placeholder="Detailed explanation and impact"
                    rows={4}
                    className="flex min-h-[80px] w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div>
                  <label htmlFor="impediment-severity" className="text-sm font-semibold text-red-900 flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Severity
                  </label>
                  <Select
                    value={impedimentData.severity}
                    onValueChange={(val) => setImpedimentData({ ...impedimentData, severity: val })}
                  >
                    <SelectTrigger className="bg-white border-red-200 focus:ring-red-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - Minor inconvenience</SelectItem>
                      <SelectItem value="medium">Medium - Slowing progress</SelectItem>
                      <SelectItem value="high">High - Blocking work</SelectItem>
                      <SelectItem value="critical">Critical - Sprint at risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900 flex items-center gap-2">
                  <LinkIcon className="h-3 w-3" />
                  This task will be linked to the selected impediment.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowImpedimentDialog(false)}
                disabled={isReporting}
                className="bg-white hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleReportImpediment}
                disabled={isReporting || (selectedImpedimentId === "new" && !impedimentData.title.trim())}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isReporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {selectedImpedimentId === "new" ? "Reporting..." : "Linking..."}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {selectedImpedimentId === "new" ? "Report Impediment" : "Link Impediment"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showEditDialog && (
        <EditTaskDialog
          open={showEditDialog}
          onClose={handleCloseEditDialog}
          task={task}
          onUpdate={handleTaskUpdateFromEdit}
        />
      )
      }
    </>
  );
}

