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
import {
    ChevronLeft,
    ChevronRight,
    Search,
    Calendar,
    AlertTriangle,
    AlertCircle,
    Activity,
    Target,
    ArrowUpRight,
    Filter,
    MoreHorizontal,
    Briefcase
} from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils/index";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
                        <Briefcase className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-blue-600 tracking-normal">Project Master List</h3>
                        <p className="text-slate-500 font-medium text-sm">Centralized telemetry for all active initiatives</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <Input
                            placeholder="Search initiatives..."
                            className="pl-10 h-11 w-full sm:w-72 bg-white border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden relative">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="border-slate-200 hover:bg-transparent px-4">
                                <TableHead className="font-black text-[11px] text-slate-400 uppercase tracking-widest h-14 px-6">Project</TableHead>
                                <TableHead className="font-black text-[11px] text-slate-400 uppercase tracking-widest h-14">Status</TableHead>
                                <TableHead className="font-black text-[11px] text-red-500/80 uppercase tracking-widest h-14 text-center">Critical</TableHead>
                                <TableHead className="font-black text-[11px] text-orange-500/80 uppercase tracking-widest h-14 text-center">High</TableHead>
                                <TableHead className="font-black text-[11px] text-amber-500/80 uppercase tracking-widest h-14 text-center">Medium</TableHead>
                                <TableHead className="font-black text-[11px] text-blue-500/80 uppercase tracking-widest h-14 text-center">Pending</TableHead>
                                <TableHead className="font-black text-[11px] text-emerald-500/80 uppercase tracking-widest h-14 text-center">Done</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <AnimatePresence mode="wait">
                                {paginatedData.length === 0 ? (
                                    <motion.tr
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        <TableCell colSpan={7} className="h-40 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                                                    <Search className="h-6 w-6" />
                                                </div>
                                                <p className="text-slate-400 font-medium">No results found matching your criteria</p>
                                            </div>
                                        </TableCell>
                                    </motion.tr>
                                ) : (
                                    paginatedData.map((row, idx) => (
                                        <motion.tr
                                            key={row.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="group border-slate-100 hover:bg-slate-50/50 transition-all duration-300"
                                        >
                                            <TableCell className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <Avatar className="h-11 w-11 rounded-2xl border-2 border-white shadow-md group-hover:scale-105 transition-transform duration-300">
                                                        <AvatarImage src={row.logo_url} />
                                                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-700 text-white text-xs font-black">
                                                            {row.name.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <span className="font-bold text-blue-600 block group-hover:text-blue-700 transition-colors">{row.name}</span>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">UID: {row.id.substring(0, 8)}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={cn(
                                                        "capitalize font-black text-[10px] tracking-widest px-3 py-1 rounded-full border shadow-none",
                                                        row.status === 'active'
                                                            ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                            : 'bg-slate-50 text-slate-500 border-slate-200'
                                                    )}
                                                >
                                                    {row.status || 'Draft'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {row.critical > 0 ? (
                                                    <button
                                                        onClick={() => handleOpenModal(row.id, row.name, 'critical')}
                                                        className="h-9 w-9 rounded-xl bg-red-50 text-red-600 font-black text-sm border border-red-100 hover:bg-red-600 hover:text-white hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 active:scale-90"
                                                    >
                                                        {row.critical}
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300 font-bold text-sm">0</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {row.high > 0 ? (
                                                    <button
                                                        onClick={() => handleOpenModal(row.id, row.name, 'high')}
                                                        className="h-9 w-9 rounded-xl bg-orange-50 text-orange-600 font-black text-sm border border-orange-100 hover:bg-orange-600 hover:text-white hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300 active:scale-90"
                                                    >
                                                        {row.high}
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300 font-bold text-sm">0</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {row.medium > 0 ? (
                                                    <button
                                                        onClick={() => handleOpenModal(row.id, row.name, 'medium')}
                                                        className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 font-black text-sm border border-amber-100 hover:bg-amber-600 hover:text-white hover:shadow-lg hover:shadow-amber-500/20 transition-all duration-300 active:scale-90"
                                                    >
                                                        {row.medium}
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300 font-bold text-sm">0</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <button
                                                    onClick={() => handleOpenModal(row.id, row.name, 'pending')}
                                                    disabled={row.pendingTasks === 0}
                                                    className={cn(
                                                        "font-black text-sm transition-all active:scale-90",
                                                        row.pendingTasks > 0 ? "text-blue-600 hover:text-blue-800" : "text-slate-300 cursor-default"
                                                    )}
                                                >
                                                    {row.pendingTasks}
                                                </button>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <button
                                                    onClick={() => handleOpenModal(row.id, row.name, 'done')}
                                                    disabled={row.doneTasks === 0}
                                                    className={cn(
                                                        "font-black text-sm transition-all active:scale-90",
                                                        row.doneTasks > 0 ? "text-emerald-600 hover:text-emerald-800" : "text-slate-300 cursor-default"
                                                    )}
                                                >
                                                    {row.doneTasks}
                                                </button>
                                            </TableCell>
                                        </motion.tr>
                                    ))
                                )}
                            </AnimatePresence>
                        </TableBody>
                    </Table>
                </div>

                {/* Modern "Cursor" Style Pagination */}
                <div className="bg-slate-50/50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="hidden sm:flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page View</span>
                        <div className="flex gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={cn(
                                        "h-2 w-2 rounded-full transition-all duration-500",
                                        currentPage === page ? "w-6 bg-blue-600" : "bg-slate-300 hover:bg-slate-400"
                                    )}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Showing</span>
                            <span className="text-sm font-black text-blue-600">{startIndex + 1}—{Math.min(startIndex + itemsPerPage, tableData.length)}</span>
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Of</span>
                            <span className="text-sm font-black text-blue-600">{tableData.length}</span>
                        </div>

                        <div className="flex gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-xl border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 disabled:opacity-30"
                                onClick={handlePrevPage}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-xl border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 disabled:opacity-30"
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Task List Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col p-0 border border-slate-200 shadow-2xl rounded-[40px] overflow-hidden">
                    <DialogHeader className="p-8 pb-6 border-b border-slate-100 bg-slate-50/30">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "h-14 w-14 rounded-2xl flex items-center justify-center border shadow-sm",
                                    selectedTaskType === 'critical' ? "bg-red-50 text-red-600 border-red-100" :
                                        selectedTaskType === 'high' ? "bg-orange-50 text-orange-600 border-orange-100" :
                                            selectedTaskType === 'medium' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                selectedTaskType === 'done' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                                    "bg-blue-50 text-blue-600 border-blue-100"
                                )}>
                                    {selectedTaskType === 'critical' ? <AlertTriangle className="h-7 w-7" /> :
                                        selectedTaskType === 'done' ? <Target className="h-7 w-7" /> :
                                            <Activity className="h-7 w-7" />}
                                </div>
                                <div>
                                    <DialogTitle className="text-3xl font-black text-blue-600 tracking-normal capitalize">
                                        {selectedTaskType} Tasks
                                    </DialogTitle>
                                    <p className="text-slate-500 font-medium">Filtering telemetry for <span className="text-blue-600 font-bold">{selectedProjectForModal?.name}</span></p>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    <ScrollArea className="flex-1 p-8 overflow-y-auto">
                        <AnimatePresence mode="wait">
                            {paginatedModalTasks.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="py-20 text-center text-slate-400 flex flex-col items-center gap-4"
                                >
                                    <div className="h-20 w-20 rounded-[32px] bg-slate-50 flex items-center justify-center">
                                        <Briefcase className="h-10 w-10 text-slate-200" />
                                    </div>
                                    <p className="font-bold tracking-normal text-lg italic">No telemetry data detected for this segment.</p>
                                </motion.div>
                            ) : (
                                <div className="grid gap-4">
                                    {paginatedModalTasks.map((task, idx) => (
                                        <motion.div
                                            key={task.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="group relative p-6 rounded-[28px] border border-slate-200 bg-white hover:border-blue-400 hover:shadow-2xl hover:shadow-blue-500/10 transition-all cursor-pointer overflow-hidden"
                                            onClick={() => {
                                                if (onTaskClick) {
                                                    onTaskClick(task.id);
                                                } else {
                                                    navigate(`${createPageUrl("ProjectDetail")}?id=${task.project_id}&taskId=${task.id}`);
                                                }
                                            }}
                                        >
                                            <div className="flex items-start justify-between gap-6">
                                                <div className="flex-1 space-y-3">
                                                    <div className="flex items-center gap-3">
                                                        <Badge className={cn(
                                                            "font-black text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-lg shadow-none",
                                                            task.priority === 'urgent' ? "bg-red-50 text-red-600 border-red-100" :
                                                                task.priority === 'high' ? "bg-orange-50 text-orange-600 border-orange-100" :
                                                                    "bg-slate-50 text-slate-500 border-slate-200"
                                                        )}>
                                                            {task.priority || 'Standard'}
                                                        </Badge>
                                                        <span className="h-1 w-1 rounded-full bg-slate-200" />
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{task.status.replace('_', ' ')}</span>
                                                    </div>

                                                    <h4 className="font-black text-blue-600 text-xl leading-tight group-hover:text-blue-700 transition-colors">
                                                        {task.title}
                                                    </h4>

                                                    <div className="flex items-center gap-4 text-xs">
                                                        {task.due_date && (
                                                            <div className="flex items-center gap-2 font-black text-slate-400 uppercase tracking-widest">
                                                                <Calendar className="h-3.5 w-3.5" />
                                                                {format(new Date(task.due_date), 'MMM d, yyyy')}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-2 font-black text-blue-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">
                                                            View Full Context <ArrowUpRight className="h-3 w-3" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </AnimatePresence>
                    </ScrollArea>

                    {/* Modal Pagination */}
                    {modalTotalPages > 1 && (
                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex gap-1.5">
                                {Array.from({ length: modalTotalPages }, (_, i) => i + 1).map((page) => (
                                    <div
                                        key={page}
                                        className={cn(
                                            "h-1.5 rounded-full transition-all duration-500",
                                            modalCurrentPage === page ? "w-4 bg-blue-600" : "w-1.5 bg-slate-300"
                                        )}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 rounded-xl border-slate-200 bg-white"
                                    onClick={() => setModalCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={modalCurrentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 rounded-xl border-slate-200 bg-white"
                                    onClick={() => setModalCurrentPage(prev => Math.min(modalTotalPages, prev + 1))}
                                    disabled={modalCurrentPage === modalTotalPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
