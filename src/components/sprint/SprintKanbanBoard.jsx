import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import TaskCard from "@/components/shared/TaskCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Settings2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit2,
  Check,
  X,
  RefreshCw
} from "lucide-react";
import UserAvailabilityIndicator from "./UserAvailabilityIndicator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { groonabackend } from "@/api/groonabackend";
import { toast } from "sonner";
import { useUser } from "@/components/shared/UserContext";
import { useQueryClient } from "@tanstack/react-query";

const DEFAULT_COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "review", title: "Review" },
  { id: "completed", title: "Done" },
];

export default function SprintKanbanBoard({
  sprint,
  tasks = [],
  allTasks = [],
  onUpdate,
  onDelete,
  showAvailability = false,
  onTaskClick,
  onEditSprint = null
}) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [localTasks, setLocalTasks] = useState(tasks);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isManageColumnsOpen, setIsManageColumnsOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [isSavingColumns, setIsSavingColumns] = useState(false);
  const [editingColumnId, setEditingColumnId] = useState(null);
  const [editColumnName, setEditColumnName] = useState("");

  const isSameTenant = useMemo(() => {
    if (!user || !sprint) return false;
    return user.tenant_id === sprint.tenant_id ||
      (user.is_super_admin && user.active_tenant_id === sprint.tenant_id);
  }, [user, sprint]);

  const isTenantAdmin = useMemo(() => {
    if (!isSameTenant) return false;
    return user.role === 'admin' || user.is_super_admin;
  }, [isSameTenant, user]);

  useEffect(() => {
    if (isSameTenant && sprint?.board_columns && Array.isArray(sprint.board_columns) && sprint.board_columns.length > 0) {
      setColumns(sprint.board_columns);
    } else {
      setColumns(DEFAULT_COLUMNS);
    }
  }, [sprint, isSameTenant]);

  const isDragDisabled = (task) => {
    if (user?.role === 'member' && user?.custom_role === 'viewer') {
      const assignees = Array.isArray(task.assigned_to) ? task.assigned_to : (task.assigned_to ? [task.assigned_to] : []);
      const userEmail = user?.email?.toLowerCase();
      const userId = user?.id;

      const isAssigned = assignees.some(assignee => {
        const assigneeVal = (typeof assignee === 'object' && assignee !== null)
          ? (assignee.email || assignee.id || '')
          : String(assignee || '');

        const normalizedAssignee = assigneeVal.toLowerCase().trim();
        const normalizedEmail = String(userEmail || '').toLowerCase().trim();
        const normalizedId = String(userId || '').toLowerCase().trim();

        return normalizedAssignee === normalizedEmail || normalizedAssignee === normalizedId;
      });

      return !isAssigned;
    }
    return false;
  };

  const pendingUpdates = useRef({});

  useEffect(() => {
    setLocalTasks((currentLocalTasks) => {
      return tasks.map(serverTask => {
        const pendingStatus = pendingUpdates.current[serverTask.id];
        if (pendingStatus) {
          if (serverTask.status === pendingStatus) {
            delete pendingUpdates.current[serverTask.id];
            return serverTask;
          } else {
            return { ...serverTask, status: pendingStatus };
          }
        }
        return serverTask;
      });
    });
  }, [tasks]);

  const handleDragEnd = (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;
    pendingUpdates.current[draggableId] = newStatus;

    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === draggableId ? { ...t, status: newStatus } : t
      )
    );

    if (destination.droppableId !== source.droppableId) {
      if (onUpdate && typeof onUpdate === 'function') {
        onUpdate(draggableId, { status: newStatus });
      }
    }
  };

  // --- NEW: Handle Local Content Updates (Real-time) ---
  const handleLocalTaskUpdate = (taskId, newData) => {
    // 1. Immediately update local state for instant feedback
    setLocalTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...newData } : t
    ));

    // 2. Propagate to parent (which handles API call if needed, though EditTaskDialog usually handles it)
    // If onUpdate is strictly for status/drag-drop, this might duplicate, but usually it's safe.
    // However, EditTaskDialog handles the API update itself. 
    // We mainly use this to trigger any parent side-effects if necessary.
    // Note: We DON'T call onUpdate(taskId, newData) here if it triggers an API call 
    // because EditTaskDialog already did that. We just update local state.
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (sprint?.id) {
        await queryClient.invalidateQueries({ queryKey: ["sprint-tasks", sprint.id] });
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success("Board refreshed");
    } catch (error) {
      console.error("Refresh failed", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ... (Column Management Functions: saveColumnsToBackend, handleAddColumn, handleDeleteColumn, etc. - UNCHANGED) ...
  const saveColumnsToBackend = async (updatedColumns) => {
    if (!isTenantAdmin) {
      toast.error("You do not have permission to modify board columns.");
      return;
    }
    setIsSavingColumns(true);
    try {
      setColumns(updatedColumns);
      if (sprint && sprint.id) {
        await groonabackend.entities.Sprint.update(sprint.id, { board_columns: updatedColumns });
        toast.success("Board configuration saved");
      }
    } catch (error) {
      console.error("Failed to save columns:", error);
      toast.error("Failed to save column configuration");
    } finally {
      setIsSavingColumns(false);
    }
  };

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;
    const columnId = newColumnName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (columns.some(c => c.id === columnId)) {
      toast.error("A column with this name already exists");
      return;
    }
    const newColumn = { id: columnId, title: newColumnName.trim() };
    const newColumns = [...columns, newColumn];
    await saveColumnsToBackend(newColumns);
    setNewColumnName("");
  };

  const handleDeleteColumn = async (columnId) => {
    const tasksInColumn = localTasks.filter(t => t.status === columnId);
    if (tasksInColumn.length > 0) {
      toast.error(`Cannot delete column. It contains ${tasksInColumn.length} tasks.`);
      return;
    }
    if (columns.length <= 1) {
      toast.error("You must have at least one column.");
      return;
    }
    const newColumns = columns.filter(c => c.id !== columnId);
    await saveColumnsToBackend(newColumns);
  };

  const handleMoveColumn = async (index, direction) => {
    const newColumns = [...columns];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newColumns.length) return;
    [newColumns[index], newColumns[targetIndex]] = [newColumns[targetIndex], newColumns[index]];
    await saveColumnsToBackend(newColumns);
  };

  const handleStartRename = (col) => {
    setEditingColumnId(col.id);
    setEditColumnName(col.title);
  };

  const handleCancelRename = () => {
    setEditingColumnId(null);
    setEditColumnName("");
  };

  const handleSaveRename = async () => {
    if (!editColumnName.trim()) {
      toast.error("Column name cannot be empty");
      return;
    }
    if (editColumnName.trim() === columns.find(c => c.id === editingColumnId)?.title) {
      handleCancelRename();
      return;
    }
    const newColumns = columns.map(c =>
      c.id === editingColumnId ? { ...c, title: editColumnName.trim() } : c
    );
    await saveColumnsToBackend(newColumns);
    handleCancelRename();
  };

  return (
    <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
      <div className="mb-4 flex items-center justify-between flex-shrink-0 px-1">
        <h3 className="text-lg font-bold text-slate-900">{sprint.name} Board</h3>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 h-9 bg-white hover:bg-slate-50 border-slate-200 shadow-sm transition-all text-slate-600"
            title="Refresh Board"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {onEditSprint && user?.custom_role !== 'viewer' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditSprint(sprint)}
              className="flex items-center gap-2 h-9 bg-white hover:bg-slate-50 border-slate-200 shadow-sm transition-all text-slate-600"
              title="Edit Sprint"
            >
              <Edit2 className="h-4 w-4" />
              <span className="hidden sm:inline">Edit Sprint</span>
            </Button>
          )}

          {isTenantAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsManageColumnsOpen(true)}
              className="flex items-center gap-2 h-9 bg-white hover:bg-slate-50 border-slate-200 shadow-sm transition-all"
            >
              <Settings2 className="h-4 w-4 text-slate-500" />
              <span className="hidden sm:inline">Edit Columns</span>
              <span className="sm:hidden">Edit</span>
            </Button>
          )}

          <Badge variant="outline" className="text-sm h-9 px-3">
            {localTasks.length} tasks
          </Badge>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 min-w-0 w-full relative h-[calc(100vh-250px)] min-h-[500px]">
          <div className="absolute inset-0 overflow-x-auto overflow-y-hidden pb-4">
            <div className="inline-flex gap-4 h-full px-1 align-top">
              {columns.map((col) => {
                const columnTasks = localTasks.filter((t) => t.status === col.id);

                return (
                  <div key={col.id} className="flex-shrink-0 w-80 flex flex-col bg-slate-100/50 rounded-xl border border-slate-200/50 max-h-full shadow-sm">
                    <div className="p-3 font-semibold text-slate-700 border-b border-slate-200 flex items-center justify-between flex-shrink-0 bg-white/50 rounded-t-xl backdrop-blur-sm">
                      <span className="truncate mr-2" title={col.title}>{col.title}</span>
                      <Badge variant="secondary" className="text-xs bg-slate-200 text-slate-700 hover:bg-slate-300">
                        {columnTasks.length}
                      </Badge>
                    </div>

                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className={`flex-1 overflow-y-auto min-h-0 p-2 flex flex-col gap-3 transition-colors ${snapshot.isDraggingOver ? "bg-slate-200/50" : ""
                            }`}
                        >
                          {columnTasks.map((task, index) => (
                            <Draggable
                              key={task.id}
                              draggableId={task.id}
                              index={index}
                              isDragDisabled={isDragDisabled(task)}
                            >
                              {(provided, snapshot) => {
                                const component = (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    style={{
                                      ...provided.draggableProps.style,
                                      opacity: snapshot.isDragging ? 0.9 : 1,
                                      cursor: 'grab',
                                      margin: 0,
                                      transform: snapshot.isDragging ? provided.draggableProps.style.transform : undefined
                                    }}
                                    className="group w-full outline-none"
                                  >
                                    <div className={snapshot.isDragging ? "" : "hover:scale-[1.02] transition-transform duration-200"}>
                                      <TaskCard
                                        task={task}
                                        allTasks={allTasks}
                                        // Pass local update handler
                                        onUpdateTask={(newData) => handleLocalTaskUpdate(task.id, newData)}
                                        onDelete={() => onDelete && typeof onDelete === 'function' ? onDelete(task.id) : null}
                                        onClick={() => {
                                          if (onTaskClick) {
                                            onTaskClick(task.id);
                                          }
                                        }}
                                        extraBadge={showAvailability && task.assigned_to && sprint?.start_date && sprint?.end_date && (
                                          <UserAvailabilityIndicator
                                            userEmail={Array.isArray(task.assigned_to) ? task.assigned_to[0] : task.assigned_to}
                                            sprintStartDate={sprint.start_date}
                                            sprintEndDate={sprint.end_date}
                                            compact={true}
                                          />
                                        )}
                                      />
                                    </div>
                                  </div>
                                );

                                if (snapshot.isDragging) {
                                  return createPortal(component, document.body);
                                }

                                return component;
                              }}
                            </Draggable>
                          ))}
                          {provided.placeholder}

                          {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                            <div className="flex items-center justify-center h-24 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                              No tasks
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
              <div className="w-1 flex-shrink-0"></div>
            </div>
          </div>
        </div>
      </DragDropContext>

      {/* Edit Column Dialogs (UNCHANGED) */}
      {isTenantAdmin && (
        <Dialog open={isManageColumnsOpen} onOpenChange={setIsManageColumnsOpen}>
          {/* ... Dialog Content (Same as previous, omitted for brevity but logic is preserved above) ... */}
          <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Edit Board Columns</DialogTitle>
              <DialogDescription>
                Add, rename, remove, or reorder columns to customize your sprint board workflow.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
              <div className="flex gap-2 items-end">
                <div className="grid w-full gap-1.5">
                  <Label htmlFor="new-col">Add New Column</Label>
                  <Input
                    id="new-col"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    placeholder="e.g. QA Ready"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                  />
                </div>
                <Button onClick={handleAddColumn} disabled={!newColumnName.trim() || isSavingColumns}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <Separator />
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between mb-2 px-1">
                  <Label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Column Order</Label>
                  <span className="text-[10px] text-slate-400">First → Last</span>
                </div>
                <ScrollArea className="h-[250px] pr-4 -mr-4">
                  <div className="space-y-2 pr-4">
                    {columns.map((col, index) => (
                      <div key={col.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg group hover:border-blue-200 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-400 hover:text-blue-600 hover:bg-blue-50" disabled={index === 0} onClick={() => handleMoveColumn(index, 'up')} title="Move Left/Up"><ArrowUp className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-400 hover:text-blue-600 hover:bg-blue-50" disabled={index === columns.length - 1} onClick={() => handleMoveColumn(index, 'down')} title="Move Right/Down"><ArrowDown className="h-3 w-3" /></Button>
                          </div>
                          <div className="flex-1 min-w-0">
                            {editingColumnId === col.id ? (
                              <div className="flex items-center gap-1">
                                <Input value={editColumnName} onChange={(e) => setEditColumnName(e.target.value)} className="h-7 text-sm" autoFocus onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(); if (e.key === 'Escape') handleCancelRename(); }} />
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 shrink-0" onClick={handleSaveRename}><Check className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0" onClick={handleCancelRename}><X className="h-4 w-4" /></Button>
                              </div>
                            ) : (
                              <div>
                                <p className="font-medium text-slate-900 text-sm truncate" title={col.title}>{col.title}</p>
                                <p className="text-[10px] text-slate-400 font-mono hidden group-hover:block transition-all truncate">ID: {col.id}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {editingColumnId !== col.id && (
                            <>
                              <Badge variant="secondary" className="text-[10px] font-mono text-slate-500 bg-white border border-slate-100 hidden sm:inline-flex">#{index + 1}</Badge>
                              <Button variant="ghost" size="icon" onClick={() => handleStartRename(col)} className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Rename Column"><Edit2 className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteColumn(col.id)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Delete Column"><Trash2 className="h-4 w-4" /></Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsManageColumnsOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

