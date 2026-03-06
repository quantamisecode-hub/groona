import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import TaskDetailDialog from "@/components/tasks/TaskDetailDialog";
import CreateTaskModal from "@/components/tasks/CreateTaskModal";
import { Button } from "@/components/ui/button";
import {
    RefreshCw,
    ListTodo,
    Search,
    Filter,
    Trash2,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    BookOpen,
    Wrench,
    AlertTriangle,
    Code,
    Clock,
    Star,
    ExternalLink,
    Plus
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/components/shared/UserContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { format } from "date-fns";

const statusBadgeStyles = {
    completed: "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-50",
    in_progress: "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-50",
    running: "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-50",
    todo: "bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-100",
    review: "bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-50",
    draft: "bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-100",
    blocked: "bg-red-50 text-red-600 border-red-100 hover:bg-red-50",
};

const priorityBadgeStyles = {
    low: "bg-blue-50 text-blue-600 border-blue-100",
    medium: "bg-amber-50 text-amber-600 border-amber-100",
    high: "bg-orange-50 text-orange-600 border-orange-100",
    urgent: "bg-red-50 text-red-600 border-red-100",
};

const taskTypeIcons = {
    story: { icon: BookOpen, color: "text-blue-500" },
    bug: { icon: "🐛", color: "" },
    task: { icon: Wrench, color: "text-zinc-500" },
    epic: { icon: AlertTriangle, color: "text-purple-500" },
    technical_debt: { icon: Code, color: "text-amber-500" },
};

export default function Tasks() {
    const { user: currentUser, loading: userLoading } = useUser();
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [showCreateTask, setShowCreateTask] = useState(false);
    const itemsPerPage = 10;

    const queryClient = useQueryClient();

    const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id
        ? currentUser.active_tenant_id
        : currentUser?.tenant_id;

    const {
        data: tasksData = { results: [], totalCount: 0 },
        isLoading: isTasksLoading,
        isRefetching,
        refetch
    } = useQuery({
        queryKey: ['all-tenant-tasks', effectiveTenantId, currentPage, searchQuery],
        queryFn: async () => {
            if (!effectiveTenantId) return { results: [], totalCount: 0 };

            const filters = { tenant_id: effectiveTenantId };
            if (searchQuery) {
                filters.$or = [
                    { title: { $regex: searchQuery, $options: 'i' } },
                    { description: { $regex: searchQuery, $options: 'i' } }
                ];
            }

            const result = await groonabackend.entities.Task.filter(filters, '-created_date', currentPage, itemsPerPage);

            // Handle both legacy (array) and paginated (object) responses
            if (Array.isArray(result)) {
                return { results: result, totalCount: result.length };
            }
            return result;
        },
        enabled: !!currentUser && !!effectiveTenantId,
        staleTime: 60 * 1000,
    });

    const tasks = tasksData.results || [];
    const totalCount = tasksData.totalCount || 0;

    // Reset to start when searching
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1);
    };

    const handleRefresh = () => {
        setCurrentPage(1);
        refetch();
    };

    // Fetch users for avatars
    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => groonabackend.entities.User.list(),
        staleTime: 5 * 60 * 1000,
    });

    // Fetch projects for mapping names and links
    const { data: projects = [] } = useQuery({
        queryKey: ['tenant-projects', effectiveTenantId],
        queryFn: async () => {
            if (!effectiveTenantId) return [];
            return groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId });
        },
        enabled: !!currentUser && !!effectiveTenantId,
        staleTime: 5 * 60 * 1000,
    });

    const handleDeleteTask = async (taskId) => {
        try {
            await groonabackend.entities.Task.delete(taskId);
            queryClient.invalidateQueries({ queryKey: ['all-tenant-tasks', effectiveTenantId] });
            toast.success("Task deleted successfully");
        } catch (error) {
            toast.error("Failed to delete task");
        }
    };

    // Pagination logic
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const paginatedTasks = tasks;

    const getInitials = (name) => {
        if (!name) return "?";
        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    const isPageLoading = (userLoading && !currentUser) || (isTasksLoading && tasks.length === 0);

    return (
        <div className="flex flex-col bg-white w-full min-h-screen">
            <div className="w-full">
                {/* Header/Filters Bar */}
                <div className="px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-100">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Tasks</h1>
                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 font-medium">
                            {totalCount}
                        </Badge>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <Input
                                placeholder="Search tasks..."
                                value={searchQuery}
                                onChange={handleSearchChange}
                                className="pl-9 h-9 bg-zinc-50 border-zinc-200 focus:bg-white transition-all text-sm rounded-lg"
                            />
                        </div>
                        <Button
                            onClick={() => setShowCreateTask(true)}
                            className="bg-gradient-to-r from-blue-600 to-slate-950 hover:from-blue-700 hover:to-black text-white shadow-xl shadow-blue-900/20 border-none gap-2 font-bold px-4 h-9 rounded-lg text-sm transition-all hover:scale-[1.02] active:scale-95"
                        >
                            <Plus className="h-4 w-4" />
                            Create New Task
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 bg-white border-zinc-200 shadow-none rounded-lg"
                            onClick={handleRefresh}
                            disabled={isPageLoading || isRefetching}
                        >
                            <RefreshCw className={`h-4 w-4 text-zinc-500 ${isRefetching ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                {/* Table Content */}
                <div className="min-w-full">
                    <Table>
                        <TableHeader className="bg-zinc-50/50">
                            <TableRow className="hover:bg-transparent border-zinc-100">
                                <TableHead className="px-6 py-3 text-[13px] font-semibold text-zinc-500">
                                    <div className="flex items-center gap-1 cursor-pointer hover:text-zinc-900 transition-colors">
                                        Task name <ArrowUpDown className="h-3.5 w-3.5" />
                                    </div>
                                </TableHead>
                                <TableHead className="px-4 py-3 text-[13px] font-semibold text-zinc-500">Project</TableHead>
                                <TableHead className="px-4 py-3 text-[13px] font-semibold text-zinc-500">Status</TableHead>
                                <TableHead className="px-4 py-3 text-[13px] font-semibold text-zinc-500">Priority</TableHead>
                                <TableHead className="px-4 py-3 text-[13px] font-semibold text-zinc-500">Users</TableHead>
                                <TableHead className="px-4 py-3 text-[13px] font-semibold text-zinc-500">Completion rate</TableHead>
                                <TableHead className="w-12 px-6"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isPageLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i} className="border-zinc-100">
                                        <TableCell className="px-6"><Skeleton className="h-4 w-4 rounded" /></TableCell>
                                        <TableCell className="px-4 py-4"><Skeleton className="h-10 w-48" /></TableCell>
                                        <TableCell className="px-4"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                        <TableCell className="px-4"><Skeleton className="h-8 w-24 rounded-full" /></TableCell>
                                        <TableCell className="px-4"><Skeleton className="h-4 w-32 rounded-full" /></TableCell>
                                        <TableCell className="px-6"><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : paginatedTasks.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center text-zinc-500">
                                            <ListTodo className="h-12 w-12 mb-3 opacity-20" />
                                            <p className="font-medium text-zinc-900">No tasks found</p>
                                            <p className="text-sm">Try adjusting your search query</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedTasks.map((task) => {
                                    const status = (task.status || "todo").toLowerCase();

                                    // Helper function for formatted status label
                                    const getStatusLabel = (statusKey) => {
                                        if (statusKey === 'todo') return 'To Do';
                                        return statusKey.replace('_', ' ');
                                    };

                                    // Calculate progress based on subtasks if available
                                    const progress = (() => {
                                        if (status === 'completed' || status === 'done') return 100;
                                        if (task.subtasks && task.subtasks.length > 0) {
                                            const completedCount = task.subtasks.filter(st => st.completed).length;
                                            return Math.round((completedCount / task.subtasks.length) * 100);
                                        }
                                        return Math.min(100, Math.max(0, task.progress || 0));
                                    })();

                                    // Get assignees safely
                                    let assignees = [];
                                    if (Array.isArray(task.assigned_to)) {
                                        assignees = task.assigned_to.filter(Boolean);
                                    } else if (task.assigned_to && typeof task.assigned_to === 'string') {
                                        assignees = task.assigned_to.split(',').map(e => e.trim()).filter(Boolean);
                                    }

                                    return (
                                        <TableRow key={task.id} className="group border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                                            <TableCell className="px-6 py-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <div
                                                        onClick={() => setSelectedTaskId(task.id)}
                                                        className="text-[14px] font-bold text-zinc-900 leading-tight hover:text-blue-600 transition-colors cursor-pointer"
                                                    >
                                                        {task.title}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {task.task_type && (
                                                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-100 rounded text-[10px] font-bold text-zinc-600">
                                                                {(() => {
                                                                    const typeConfig = taskTypeIcons[task.task_type] || taskTypeIcons.task;
                                                                    if (typeof typeConfig.icon === 'string') return <span>{typeConfig.icon}</span>;
                                                                    const Icon = typeConfig.icon;
                                                                    return <Icon className={`h-3 w-3 ${typeConfig.color}`} />;
                                                                })()}
                                                                {task.task_type.toUpperCase().replace('_', ' ')}
                                                            </div>
                                                        )}
                                                        {task.story_points > 0 && (
                                                            <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 rounded text-[10px] font-bold text-amber-600 border border-amber-100">
                                                                <Star className="h-2.5 w-2.5 fill-amber-500" /> {task.story_points}
                                                            </div>
                                                        )}
                                                        {task.estimated_hours > 0 && (
                                                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 rounded text-[10px] font-bold text-blue-600 border border-blue-100">
                                                                <Clock className="h-2.5 w-2.5" /> {task.estimated_hours}h
                                                            </div>
                                                        )}
                                                        <span className="text-[11px] font-medium text-zinc-400">
                                                            {task.created_date ? format(new Date(task.created_date), 'dd-MM-yyyy') : 'N/A'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-4">
                                                <div className="flex flex-col">
                                                    {(() => {
                                                        const project = projects.find(p => p.id === task.project_id);
                                                        const projectName = project?.name || task.project_name || "Self Task";
                                                        return (
                                                            <>
                                                                <span className="text-[13px] font-bold text-zinc-700 truncate max-w-[150px]" title={projectName}>
                                                                    {projectName}
                                                                </span>
                                                                {task.project_id && (
                                                                    <Link
                                                                        to={`/ProjectDetail?id=${task.project_id}`}
                                                                        className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 font-medium"
                                                                    >
                                                                        Go to project <ExternalLink className="h-2 w-2" />
                                                                    </Link>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4">
                                                <Badge variant="outline" className={`${statusBadgeStyles[status] || statusBadgeStyles.todo} px-3 py-1 rounded-full text-[12px] font-bold border capitalize shadow-none`}>
                                                    {getStatusLabel(status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-4">
                                                <Badge variant="outline" className={`${priorityBadgeStyles[task.priority || 'medium']} px-3 py-1 rounded-full text-[11px] font-bold border capitalize shadow-none`}>
                                                    {task.priority || 'medium'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-4">
                                                <div className="flex -space-x-1.5 overflow-hidden">
                                                    {assignees.slice(0, 4).map((email, idx) => {
                                                        const user = users.find(u => u.email === email);
                                                        return (
                                                            <Avatar key={idx} className="h-7 w-7 border-2 border-white shadow-sm ring-1 ring-zinc-100/5">
                                                                <AvatarImage src={user?.profile_image_url} />
                                                                <AvatarFallback className="text-[9px] bg-zinc-100 text-zinc-600 font-bold">
                                                                    {user?.full_name ? getInitials(user.full_name) : "?"}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        );
                                                    })}
                                                    {assignees.length > 4 && (
                                                        <div className="h-7 w-7 rounded-full bg-zinc-50 border-2 border-white flex items-center justify-center text-[10px] font-bold text-zinc-500 shadow-sm ring-1 ring-zinc-100/5">
                                                            +{assignees.length - 4}
                                                        </div>
                                                    )}
                                                    {assignees.length === 0 && <span className="text-zinc-400 text-xs italic">Unassigned</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4">
                                                <div className="flex items-center gap-3 w-full min-w-[100px]">
                                                    <Progress value={progress} className="h-2 flex-1 bg-zinc-100" indicatorClassName="bg-blue-600 rounded-full" />
                                                    <span className="text-[13px] font-bold text-zinc-600 w-9 text-right">{progress}%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-6 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all rounded-lg"
                                                    onClick={() => handleDeleteTask(task.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination Bar */}
                {!isPageLoading && totalPages > 1 && (
                    <div className="px-6 py-6 border-t border-zinc-100 flex items-center justify-between">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="gap-2 px-4 h-9 font-bold text-zinc-600 border-zinc-200 shadow-none rounded-lg"
                        >
                            <ChevronLeft className="h-4 w-4" /> Previous
                        </Button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }).map((_, i) => {
                                const pageNum = i + 1;
                                // Simple pagination display: Show first, last, current, and current neighbor
                                if (
                                    pageNum === 1 ||
                                    pageNum === totalPages ||
                                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                ) {
                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={currentPage === pageNum ? "secondary" : "ghost"}
                                            size="sm"
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`h-9 w-9 font-bold rounded-lg ${currentPage === pageNum ? 'bg-zinc-100 text-zinc-900 shadow-none' : 'text-zinc-500 hover:bg-zinc-50'}`}
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                } else if (
                                    pageNum === currentPage - 2 ||
                                    pageNum === currentPage + 2
                                ) {
                                    return <span key={pageNum} className="px-2 text-zinc-300">...</span>;
                                }
                                return null;
                            })}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="gap-2 px-4 h-9 font-bold text-zinc-600 border-zinc-200 shadow-none rounded-lg"
                        >
                            Next <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            <TaskDetailDialog
                taskId={selectedTaskId}
                open={!!selectedTaskId}
                onClose={() => setSelectedTaskId(null)}
            />

            <CreateTaskModal
                open={showCreateTask}
                onClose={() => setShowCreateTask(false)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["tasks"] });
                    setShowCreateTask(false);
                }}
            />
        </div>
    );
}
