import React from "react";
import TaskCard from "../shared/TaskCard";

export default function TaskItem({ task, onUpdate, onDelete, allTasks = [] }) {
  return (
    <TaskCard
      task={task}
      onUpdate={onUpdate}
      onDelete={onDelete}
      showProject={false}
      allTasks={allTasks}
    />
  );
}