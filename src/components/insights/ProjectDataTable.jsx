/* eslint-disable react/prop-types */
import { useState, useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, Search, Calendar, AlertTriangle, AlertCircle, Activity, Target } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils/index";

export default function ProjectDataTable({ projects, tasks, onTaskClick }) {
    const navigate = useNavigate();
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const itemsPerPage = 10;

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProjectForModal, setSelectedProjectForModal] = useState(null);
    const [selectedTaskType, setSelectedTaskType] = useState(null); // 'critical', 'high', 'medium', 'pending', 'done'
    const [modalCurrentPage, setModalCurrentPage] = useState(1);
    const modalItemsPerPage = 5;

    // Process data for the table
    const tableData = useMemo(() => {
        return projects.map((project) => {
            const projectTasks = tasks.filter((t) => t.project_id === project.id);
            const pendingProjectTasks = projectTasks.filter((t) => t.status !== "completed");

            const critical = pendingProjectTasks.filter(t => t.priority === 'urgent').length;
            const high = pendingProjectTasks.filter(t => t.priority === 'high').length;
            const medium = pendingProjectTasks.filter(t => t.priority === 'medium').length;

            const pendingTasks = pendingProjectTasks.length;
            const doneTasks = projectTasks.filter((t) => t.status === "completed").length;

            return {
                id: project.id,
                name: project.name,
                logo_url: project.logo_url,
                status: project.status, // e.g., 'active', 'completed', 'inactive'
                critical,
                high,
                medium,
                pendingTasks,
                doneTasks,
            };
        }).filter(project =>
            project.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [projects, tasks, searchQuery]);

    // Pagination logic
    const totalPages = Math.ceil(tableData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedData = tableData.slice(startIndex, startIndex + itemsPerPage);

    const handleNextPage = () => {
        if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
    };

    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage((prev) => prev - 1);
    };

    // Open the modal for a specific project & task type
    const handleOpenModal = (projectId, projectName, taskType) => {
        setSelectedProjectForModal({ id: projectId, name: projectName });
        setSelectedTaskType(taskType);
        setModalCurrentPage(1); // Reset page when opening modal
        setIsModalOpen(true);
    };

    // Calculate tasks to show inside the modal
    const getModalTasks = () => {
        if (!selectedProjectForModal || !selectedTaskType) return [];

        const projectTasks = tasks.filter((t) => t.project_id === selectedProjectForModal.id);
        const pendingTasks = projectTasks.filter((t) => t.status !== "completed");

        switch (selectedTaskType) {
            case 'pending':
                return pendingTasks;
            case 'done':
                return projectTasks.filter((t) => t.status === "completed");
            case 'critical':
                return pendingTasks.filter(t => t.priority === 'urgent');
            case 'high':
                return pendingTasks.filter(t => t.priority === 'high');
            case 'medium':
                return pendingTasks.filter(t => t.priority === 'medium');
            default:
                return [];
        }
    };

    const modalTasks = getModalTasks();
    const modalTotalPages = Math.ceil(modalTasks.length / modalItemsPerPage);
    const modalStartIndex = (modalCurrentPage - 1) * modalItemsPerPage;
    const paginatedModalTasks = modalTasks.slice(modalStartIndex, modalStartIndex + modalItemsPerPage);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">Project Master List</h3>
                <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                        placeholder="Search projects..."
                        className="pl-9 h-9 border-slate-200"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1); // Reset to first page on search
                        }}
                    />
                </div>
            </div>

            <div className="rounded-xl border border-slate-200/60 bg-white/60 backdrop-blur-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="border-slate-200/60 hover:bg-transparent">
                                <TableHead className="font-semibold text-slate-700 w-[250px]">Project</TableHead>
                                <TableHead className="font-semibold text-slate-700">Status</TableHead>
                                <TableHead className="font-semibold text-red-600 text-center">Critical Tasks</TableHead>
                                <TableHead className="font-semibold text-orange-600 text-center">High Tasks</TableHead>
                                <TableHead className="font-semibold text-amber-600 text-center">Medium Tasks</TableHead>
                                <TableHead className="font-semibold text-blue-600 text-center">Pending</TableHead>
                                <TableHead className="font-semibold text-emerald-600 text-center">Done</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                                        No projects found for your search.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedData.map((row) => (
                                    <TableRow key={row.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors">
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8 border border-slate-200 shadow-sm">
                                                    <AvatarImage src={row.logo_url} />
                                                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold">
                                                        {row.name.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="font-medium text-slate-900">{row.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                className={`capitalize font-medium px-2.5 py-0.5 rounded-full ${row.status === 'active'
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200/50 hover:bg-blue-100'
                                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                                    }`}
                                                variant="outline"
                                            >
                                                {row.status || 'Unknown'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {row.critical > 0 ? (
                                                <button
                                                    onClick={() => handleOpenModal(row.id, row.name, 'critical')}
                                                    className="inline-flex items-center justify-center bg-red-100 hover:bg-red-200 hover:scale-110 transition-all text-red-700 font-bold h-7 w-7 rounded-full text-xs shadow-sm"
                                                >
                                                    {row.critical}
                                                </button>
                                            ) : (
                                                <span className="inline-flex items-center justify-center bg-slate-100 text-slate-400 font-bold h-7 w-7 rounded-full text-xs shadow-sm opacity-60">0</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {row.high > 0 ? (
                                                <button
                                                    onClick={() => handleOpenModal(row.id, row.name, 'high')}
                                                    className="inline-flex items-center justify-center bg-orange-100 hover:bg-orange-200 hover:scale-110 transition-all text-orange-700 font-bold h-7 w-7 rounded-full text-xs shadow-sm"
                                                >
                                                    {row.high}
                                                </button>
                                            ) : (
                                                <span className="inline-flex items-center justify-center bg-slate-100 text-slate-400 font-bold h-7 w-7 rounded-full text-xs shadow-sm opacity-60">0</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {row.medium > 0 ? (
                                                <button
                                                    onClick={() => handleOpenModal(row.id, row.name, 'medium')}
                                                    className="inline-flex items-center justify-center bg-amber-100 hover:bg-amber-200 hover:scale-110 transition-all text-amber-700 font-bold h-7 w-7 rounded-full text-xs shadow-sm"
                                                >
                                                    {row.medium}
                                                </button>
                                            ) : (
                                                <span className="inline-flex items-center justify-center bg-slate-100 text-slate-400 font-bold h-7 w-7 rounded-full text-xs shadow-sm opacity-60">0</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <button
                                                onClick={() => handleOpenModal(row.id, row.name, 'pending')}
                                                disabled={row.pendingTasks === 0}
                                                className={`font-semibold hover:underline decoration-blue-500 underline-offset-4 ${row.pendingTasks > 0 ? 'text-blue-600 cursor-pointer' : 'text-slate-400 cursor-default opacity-60'}`}
                                            >
                                                {row.pendingTasks > 0 ? row.pendingTasks : 0}
                                            </button>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <button
                                                onClick={() => handleOpenModal(row.id, row.name, 'done')}
                                                disabled={row.doneTasks === 0}
                                                className={`font-semibold hover:underline decoration-emerald-500 underline-offset-4 ${row.doneTasks > 0 ? 'text-emerald-600 cursor-pointer' : 'text-slate-400 cursor-default opacity-60'}`}
                                            >
                                                {row.doneTasks > 0 ? row.doneTasks : 0}
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2">
                    <p className="text-xs text-slate-500 font-medium">
                        Showing <span className="text-slate-900">{startIndex + 1}</span> to <span className="text-slate-900">{Math.min(startIndex + itemsPerPage, tableData.length)}</span> of <span className="text-slate-900">{tableData.length}</span> projects
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-slate-200 text-slate-600"
                            onClick={handlePrevPage}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                        </Button>
                        <div className="text-xs font-semibold text-slate-700 px-2 border border-slate-200 bg-white h-8 flex items-center justify-center rounded-md min-w-[32px]">
                            {currentPage}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-slate-200 text-slate-600"
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Task List Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-4 pb-3 border-b border-slate-100 bg-slate-50/50">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <span className="capitalize text-slate-800">{selectedTaskType} Tasks</span>
                            <span className="text-slate-400 font-normal text-sm">for</span>
                            <span className="font-semibold text-slate-700">{selectedProjectForModal?.name}</span>
                        </DialogTitle>
                    </DialogHeader>

                    <ScrollArea className="flex-1 p-4 overflow-y-auto">
                        {paginatedModalTasks.length === 0 ? (
                            <div className="py-12 text-center text-slate-500 flex flex-col items-center">
                                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                    <Search className="h-5 w-5 text-slate-400" />
                                </div>
                                <p>No tasks found in this category.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {paginatedModalTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
                                        onClick={() => {
                                            if (onTaskClick) {
                                                onTaskClick(task.id);
                                            } else {
                                                navigate(`${createPageUrl("ProjectDetail")}?id=${task.project_id}&taskId=${task.id}`);
                                            }
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1.5 relative pr-4 w-full">
                                                <div className="flex items-center justify-between mb-1">
                                                    {task.priority ? (
                                                        <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                                            {task.priority === 'urgent' && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                                                            {task.priority === 'high' && <AlertCircle className="h-3.5 w-3.5 text-orange-500" />}
                                                            {task.priority === 'medium' && <Activity className="h-3.5 w-3.5 text-amber-500" />}
                                                            <span className="text-xs font-semibold capitalize text-slate-600">{task.priority}</span>
                                                        </div>
                                                    ) : <div />}
                                                </div>

                                                <h4 className="font-bold text-slate-800 text-sm leading-snug break-words group-hover:text-indigo-600 transition-colors flex items-start gap-2 pt-0.5">
                                                    <Target className="h-4 w-4 mt-0.5 text-slate-400 group-hover:text-indigo-500 shrink-0" />
                                                    {task.title}
                                                </h4>

                                                <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
                                                    <Badge
                                                        variant="secondary"
                                                        className={`capitalize font-semibold border-0 ${task.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                                task.status === 'review' ? 'bg-purple-100 text-purple-700' :
                                                                    'bg-slate-100 text-slate-700'
                                                            }`}
                                                    >
                                                        {task.status.replace('_', ' ')}
                                                    </Badge>

                                                    {task.due_date && (
                                                        <div className="flex items-center gap-1.5 font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md">
                                                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                            {format(new Date(task.due_date), 'MMM d, yyyy')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Modal Pagination */}
                    {modalTotalPages > 1 && (
                        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <p className="text-xs text-slate-500 font-medium">
                                Showing {modalStartIndex + 1} to {Math.min(modalStartIndex + modalItemsPerPage, modalTasks.length)} of {modalTasks.length} tasks
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => setModalCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={modalCurrentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Prev
                                </Button>
                                <div className="text-xs font-semibold px-3 h-8 flex items-center justify-center rounded-md min-w-[32px]">
                                    {modalCurrentPage} / {modalTotalPages}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => setModalCurrentPage(prev => Math.min(modalTotalPages, prev + 1))}
                                    disabled={modalCurrentPage === modalTotalPages}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
