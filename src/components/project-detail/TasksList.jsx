import React from "react";
import { Card } from "@/components/ui/card";
import TaskItem from "./TaskItem";
import { motion } from "framer-motion";

export default function TasksList({ tasks, loading, onUpdate, onDelete, allTasks = [] }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-white/60 backdrop-blur-xl rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card className="p-12 text-center bg-white/60 backdrop-blur-xl border-slate-200/60">
        <p className="text-slate-600">No tasks yet. Create your first task!</p>
      </Card>
    );
  }

  const groupedTasks = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    review: tasks.filter(t => t.status === 'review'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

  return (
    <div className="space-y-8">
      {Object.entries(groupedTasks).map(([status, statusTasks]) => (
        statusTasks.length > 0 && (
          <div key={status}>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 capitalize">
              {status.replace('_', ' ')} ({statusTasks.length})
            </h3>
            <div className="space-y-3">
              {statusTasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <TaskItem
                    task={task}
                    onUpdate={(data) => onUpdate(task.id, data)}
                    onDelete={() => onDelete(task.id)}
                    allTasks={allTasks}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
}