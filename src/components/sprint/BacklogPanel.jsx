import React from "react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, CheckCircle2, Clock, Ban, AlertCircle } from "lucide-react";
import TaskCard from "@/components/shared/TaskCard";

export default function BacklogPanel({ tasks, onSearch, onFilter, filters, onMoveTask, onUpdate, onDelete, isLocked = false }) {
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getTaskStatus = (task) => {
    if (!task.story_points) return { label: "Not estimated", color: "text-slate-500", icon: Clock };
    if (task.dependencies && task.dependencies.length > 0) {
       return { label: "Blocked", color: "text-red-500", icon: Ban };
    }
    const isReady = task.description && task.story_points && task.assigned_to;
    if (isReady) return { label: "Ready", color: "text-green-600", icon: CheckCircle2 };
    return { label: "Not Ready", color: "text-amber-500", icon: AlertCircle };
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 border-r border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Backlog</h3>
          <Badge variant="secondary">{filteredTasks.length} items</Badge>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search backlog..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Droppable droppableId="backlog">
        {(provided, snapshot) => (
          <div className="flex-1 overflow-y-auto min-h-0">
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`p-4 space-y-3 ${
                snapshot.isDraggingOver ? 'bg-slate-100/50' : ''
              }`}
            >
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <div className="mb-2 text-2xl">🎯</div>
                    <p className="font-medium">Nothing in backlog yet.</p>
                    <p className="text-sm">Add user stories to get started.</p>
                  </div>
                ) : (
                  filteredTasks.map((task, index) => {
                    const status = getTaskStatus(task);
                    const StatusIcon = status.icon;
                    
                    return (
                      <Draggable 
                        key={String(task.id)} 
                        draggableId={String(task.id)} 
                        index={index}
                        isDragDisabled={isLocked}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="group relative"
                            style={{
                              ...provided.draggableProps.style,
                              marginBottom: '8px'
                            }}
                          >
                            <TaskCard 
                              task={task} 
                              isDragging={snapshot.isDragging}
                              onUpdate={onUpdate ? (data) => onUpdate(task.id, data) : null}
                              onDelete={onDelete ? () => onDelete(task.id) : null}
                            />
                            
                            <div className="absolute top-2 right-2 flex gap-1 z-10">
                               <Badge variant="outline" className={`bg-white/90 backdrop-blur-sm text-[10px] h-5 px-1 ${status.color} border-slate-200 shadow-sm`}>
                                 <StatusIcon className="w-3 h-3 mr-1" />
                                 {status.label}
                               </Badge>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })
                )}
                {provided.placeholder}
              </div>
          </div>
        )}
      </Droppable>
    </div>
  );
}