import React from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import GanttTimeline from "../components/projects/GanttTimeline";

export default function Timeline() {
  const { data: tasks = [] } = useQuery({
    queryKey: ['all-tasks'],
    queryFn: () => groonabackend.entities.Task.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => groonabackend.entities.Project.list(),
  });

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Project Timeline</h1>
        <p className="text-slate-600">Visualize task schedules and dependencies across all projects</p>
      </div>

      <GanttTimeline tasks={tasks} projects={projects} />
    </div>
  );
}

