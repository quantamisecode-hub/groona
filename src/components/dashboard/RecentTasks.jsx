import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Clock, ListTodo, AlertCircle } from "lucide-react";
import TaskDetailDialog from "../tasks/TaskDetailDialog";

export default function RecentTasks({ tasks, loading, title = "Recent Tasks" }) {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  React.useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser).catch(() => { });
  }, []);

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }) => {
      const updated = await groonabackend.entities.Task.update(taskId, data);

      if (currentUser) {
        try {
          await groonabackend.entities.Activity.create({
            action: data.status === 'completed' ? 'completed' : 'updated',
            entity_type: 'task',
            entity_id: taskId,
            entity_name: updated.title,
            project_id: updated.project_id,
            user_email: currentUser.email,
            user_name: currentUser.full_name,
            tenant_id: updated.tenant_id,
            details: `Task status changed to ${data.status.replace('_', ' ')}`
          });
        } catch (error) {
          console.error('Activity creation failed:', error);
        }
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      toast.success('Task status updated');
    },
    onError: (error) => {
      console.error('Update error:', error);
      toast.error('Failed to update task');
    },
  });

  if (loading) {
    return (
      <Card className="bg-white border-0 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-100/80 rounded-[24px]">
        <CardHeader className="p-6 pb-3">
          <CardTitle className="text-[17px] font-semibold text-slate-900 tracking-tight">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-6 pb-6 pt-0">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[72px] w-full rounded-[20px]" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-0 shadow-sm ring-1 ring-slate-100/80 rounded-3xl overflow-hidden">
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-lg font-bold text-slate-900 tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-6 pb-6 pt-0">
        {tasks.length === 0 ? (
          <div className="text-center py-12 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
            <CheckCircle2 className="h-10 w-10 text-slate-300 mx-auto mb-4" />
            <p className="text-base text-slate-600 font-bold tracking-tight">No active tasks</p>
            <p className="text-sm text-slate-400 mt-1 font-medium italic">You're all caught up!</p>
          </div>
        ) : (
          tasks.map(task => {
            return (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className="group flex flex-col p-4 rounded-2xl bg-slate-50 border border-slate-100/50 hover:bg-slate-100/80 hover:border-blue-100 transition-all duration-300 cursor-pointer overflow-hidden shadow-sm shadow-black/[0.02]"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate tracking-tight">{task.title}</p>
                    {task.project_id && (
                      <p className="text-xs text-slate-500 truncate mt-1 font-medium">Assigned to you</p>
                    )}
                  </div>

                  <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={task.status || "todo"}
                      onValueChange={(value) => updateTaskMutation.mutate({ taskId: task.id, data: { status: value } })}
                    >
                      <SelectTrigger className="h-8.5 w-full sm:w-32 rounded-lg text-xs font-bold bg-white shadow-sm border border-slate-200/60 focus:ring-0 focus:border-blue-400 hover:border-blue-300 transition-all">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg shadow-xl border-slate-100">
                        <SelectItem value="todo" className="rounded-lg my-1 cursor-pointer font-medium">
                          <div className="flex items-center gap-2.5"><ListTodo className="h-4 w-4 text-slate-400" /> To Do</div>
                        </SelectItem>
                        <SelectItem value="in_progress" className="rounded-lg my-1 cursor-pointer font-medium">
                          <div className="flex items-center gap-2.5"><Clock className="h-4 w-4 text-blue-500" /> In Progress</div>
                        </SelectItem>
                        <SelectItem value="review" className="rounded-lg my-1 cursor-pointer font-medium">
                          <div className="flex items-center gap-2.5"><AlertCircle className="h-4 w-4 text-amber-500" /> Review</div>
                        </SelectItem>
                        <SelectItem value="completed" className="rounded-lg my-1 cursor-pointer font-medium">
                          <div className="flex items-center gap-2.5"><CheckCircle2 className="h-4 w-4 text-green-500" /> Completed</div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {/* Pop Out Detailed Modal */}
      {selectedTask && (
        <TaskDetailDialog
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          taskId={selectedTask.id}
          initialTask={selectedTask}
        />
      )}
    </Card>
  );
}
