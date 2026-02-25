import React from "react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Trash2 } from "lucide-react";
import TaskCard from "@/components/shared/TaskCard";
import { Button } from "@/components/ui/button";

export default function SprintBacklogPanel({ tasks, sprint, onRemoveFromSprint, onUpdate, onDelete, isLocked = false }) {
  const totalPoints = tasks.reduce((acc, t) => acc + (t.story_points || 0), 0);

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg">Sprint Backlog</h3>
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">
            Total: {totalPoints} pts
          </Badge>
        </div>
        <p className="text-sm text-slate-500">
          {isLocked 
            ? 'Sprint scope is locked. Drag and drop is disabled.' 
            : sprint.status === 'draft' 
              ? 'Drag items here to plan.' 
              : 'Committed items for this sprint.'}
        </p>
      </div>

      <Droppable droppableId={String(sprint.id)}>
        {(provided, snapshot) => (
          <div className="flex-1 overflow-y-auto min-h-0">
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`p-4 space-y-3 ${
                snapshot.isDraggingOver ? 'bg-blue-50/50' : ''
              }`}
            >
                {tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-lg mx-4 mt-4">
                    <div className="bg-slate-50 p-3 rounded-full mb-3">
                      <AlertCircle className="h-6 w-6" />
                    </div>
                    <p className="font-medium text-slate-600">Sprint is empty</p>
                    <p className="text-sm mt-1 max-w-xs">
                      Drag your highest-priority backlog items here to plan this sprint.
                    </p>
                  </div>
                ) : (
                  tasks.map((task, index) => (
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
                          
                          {sprint.status !== 'completed' && (
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute -right-2 -top-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveFromSprint(task.id);
                              }}
                              title="Remove from sprint"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
              </div>
          </div>
        )}
      </Droppable>
    </div>
  );
}