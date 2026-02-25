import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function ReportFilters({ filters, onFiltersChange, projects, users }) {
  const updateFilter = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleProject = (projectId) => {
    const current = filters.project_ids || [];
    const updated = current.includes(projectId)
      ? current.filter(id => id !== projectId)
      : [...current, projectId];
    updateFilter('project_ids', updated);
  };

  const toggleUser = (userEmail) => {
    const current = filters.user_emails || [];
    const updated = current.includes(userEmail)
      ? current.filter(e => e !== userEmail)
      : [...current, userEmail];
    updateFilter('user_emails', updated);
  };

  const toggleApprovalStatus = (status) => {
    const current = filters.approval_status || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    updateFilter('approval_status', updated);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Date Range */}
      <div className="space-y-2 lg:col-span-2">
        <Label>Date Range</Label>
        <div className="flex gap-2 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.date_range_start ? format(new Date(filters.date_range_start), 'MMM d, yyyy') : 'Start Date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.date_range_start ? new Date(filters.date_range_start) : undefined}
                onSelect={(date) => updateFilter('date_range_start', format(date, 'yyyy-MM-dd'))}
              />
            </PopoverContent>
          </Popover>
          <span className="text-slate-500">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.date_range_end ? format(new Date(filters.date_range_end), 'MMM d, yyyy') : 'End Date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.date_range_end ? new Date(filters.date_range_end) : undefined}
                onSelect={(date) => updateFilter('date_range_end', format(date, 'yyyy-MM-dd'))}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Billable Status */}
      <div className="space-y-2">
        <Label>Billable Status</Label>
        <Select value={filters.billable_status} onValueChange={(val) => updateFilter('billable_status', val)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time Entries</SelectItem>
            <SelectItem value="billable">Billable Only</SelectItem>
            <SelectItem value="non_billable">Non-Billable Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Projects Filter */}
      <div className="space-y-2 lg:col-span-2">
        <Label>Projects ({(filters.project_ids || []).length} selected)</Label>
        <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto bg-white">
          <div className="space-y-2">
            {projects.map(project => (
              <div key={project.id} className="flex items-center gap-2">
                <Checkbox
                  id={`project-${project.id}`}
                  checked={(filters.project_ids || []).includes(project.id)}
                  onCheckedChange={() => toggleProject(project.id)}
                />
                <Label htmlFor={`project-${project.id}`} className="cursor-pointer flex-1">
                  {project.name}
                </Label>
              </div>
            ))}
            {projects.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-2">No projects available</p>
            )}
          </div>
        </div>
        {(filters.project_ids || []).length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateFilter('project_ids', [])}
            className="w-full text-slate-600"
          >
            Clear Selection
          </Button>
        )}
      </div>

      {/* Approval Status */}
      <div className="space-y-2">
        <Label>Approval Status</Label>
        <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
          {['draft', 'submitted', 'approved', 'rejected'].map(status => (
            <div key={status} className="flex items-center gap-2">
              <Checkbox
                id={`status-${status}`}
                checked={(filters.approval_status || []).includes(status)}
                onCheckedChange={() => toggleApprovalStatus(status)}
              />
              <Label htmlFor={`status-${status}`} className="cursor-pointer capitalize">
                {status}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Users Filter */}
      <div className="space-y-2 lg:col-span-3">
        <Label>Team Members ({(filters.user_emails || []).length} selected)</Label>
        <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {users.map(user => (
              <div key={user.email} className="flex items-center gap-2">
                <Checkbox
                  id={`user-${user.email}`}
                  checked={(filters.user_emails || []).includes(user.email)}
                  onCheckedChange={() => toggleUser(user.email)}
                />
                <Label htmlFor={`user-${user.email}`} className="cursor-pointer flex-1 text-sm">
                  {user.full_name || user.email}
                </Label>
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-2 col-span-3">No users available</p>
            )}
          </div>
        </div>
        {(filters.user_emails || []).length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateFilter('user_emails', [])}
            className="w-full text-slate-600"
          >
            Clear Selection
          </Button>
        )}
      </div>
    </div>
  );
}