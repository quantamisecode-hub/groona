import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Filter, X } from "lucide-react";

export default function TimesheetFilters({
    isAdmin,
    isPM,
    users,
    uniqueProjects,
    filters,
    onFilterChange,
    onClearFilters,
    hasActiveFilters
}) {
    const { statusFilter, projectFilter, dateRangeFilter, userFilter } = filters;

    // Filter Controls Component (Shared between Desktop Popover and Mobile Sheet)
    const FilterControls = () => (
        <div className="flex flex-col gap-4">
            {/* User Filter (Admin/PM Only) */}
            {(isAdmin || isPM) && (
                <div className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">User</span>
                    <Select
                        value={userFilter}
                        onValueChange={(val) => onFilterChange('userFilter', val)}
                    >
                        <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                            <SelectValue placeholder="All Users" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Users</SelectItem>
                            {users.map((u) => (
                                <SelectItem key={u.id} value={u.email}>
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6 ring-1 ring-slate-200">
                                            <AvatarImage src={u.profile_image_url} />
                                            <AvatarFallback className="text-[10px] bg-slate-100">
                                                {u.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="truncate">{u.full_name || u.email}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Status Filter */}
            <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Status</span>
                <Select
                    value={statusFilter}
                    onValueChange={(val) => onFilterChange('statusFilter', val)}
                >
                    <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="draft">Drafts</SelectItem>
                        <SelectItem value="pending_pm">Pending PM</SelectItem>
                        <SelectItem value="pending_admin">Pending Admin</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Project Filter */}
            <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Project</span>
                <Select
                    value={projectFilter}
                    onValueChange={(val) => onFilterChange('projectFilter', val)}
                >
                    <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                        <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Projects</SelectItem>
                        {uniqueProjects.map(([id, name]) => (
                            <SelectItem key={id} value={id}>{name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Time Range Filter */}
            <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Time Range</span>
                <Select
                    value={dateRangeFilter}
                    onValueChange={(val) => onFilterChange('dateRangeFilter', val)}
                >
                    <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                        <SelectValue placeholder="All Time" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">Past 7 Days</SelectItem>
                        <SelectItem value="month">Past 30 Days</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
                <Button
                    variant="outline"
                    onClick={onClearFilters}
                    className="w-full mt-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                >
                    <X className="w-4 h-4 mr-2" />
                    Clear Filters
                </Button>
            )}
        </div>
    );

    // Active Filter Count
    const activeCount = [
        statusFilter !== "all",
        projectFilter !== "all",
        dateRangeFilter !== "all",
        userFilter !== "all"
    ].filter(Boolean).length;

    return (
        <>
            {/* Mobile: Sheet */}
            <div className="md:hidden">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 w-9 p-0 shrink-0 bg-white/80 backdrop-blur-xl border-slate-200">
                            <Filter className="h-4 w-4 text-slate-600" />
                            {activeCount > 0 && (
                                <div className="absolute -top-1.5 -right-1.5 h-3.5 min-w-[14px] px-0.5 rounded-full bg-blue-600 text-[9px] font-bold text-white flex items-center justify-center border-2 border-slate-50">
                                    {activeCount}
                                </div>
                            )}
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="rounded-t-xl max-h-[85vh] overflow-y-auto">
                        <SheetHeader className="mb-4 text-left">
                            <SheetTitle>Filter Timesheets</SheetTitle>
                        </SheetHeader>
                        <FilterControls />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop: Popover */}
            <div className="hidden md:block">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className={`h-9 gap-2 bg-white/80 backdrop-blur-xl border-slate-200 transition-all ${activeCount > 0 ? "text-blue-600 border-blue-200 bg-blue-50/50" : "text-slate-600"}`}
                        >
                            <Filter className="h-4 w-4" />
                            <span>Filters</span>
                            {activeCount > 0 && (
                                <Badge variant="secondary" className="h-5 px-1.5 min-w-[20px] bg-blue-100 text-blue-700 hover:bg-blue-100 ml-auto pointer-events-none">
                                    {activeCount}
                                </Badge>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-5 mr-4" align="end">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-slate-900 leading-none">Filters</h4>
                            {activeCount > 0 && (
                                <span className="text-xs text-slate-500">{activeCount} active</span>
                            )}
                        </div>
                        <FilterControls />
                    </PopoverContent>
                </Popover>
            </div>
        </>
    );
}
