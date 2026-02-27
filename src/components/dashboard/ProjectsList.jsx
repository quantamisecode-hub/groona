import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ArrowRight, Folder } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";

const statusColors = {
  planning: "bg-slate-100 text-slate-700 border-slate-200",
  active: "bg-blue-100 text-blue-700 border-blue-200",
  on_hold: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-green-100 text-green-700 border-green-200",
};

export default function ProjectsList({ projects, loading }) {
  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => groonabackend.entities.Workspace.list(),
  });

  // Fetch all stories for all projects
  const { data: allStories = [] } = useQuery({
    queryKey: ['all-stories-for-projects', projects.map(p => p.id).join(',')],
    queryFn: async () => {
      if (!projects.length) return [];
      const projectIds = projects.map(p => p.id).filter(Boolean);
      if (projectIds.length === 0) return [];

      // Fetch stories for all projects
      const storyPromises = projectIds.map(projectId =>
        groonabackend.entities.Story.filter({ project_id: projectId })
      );
      const storyArrays = await Promise.all(storyPromises);
      return storyArrays.flat();
    },
    enabled: projects.length > 0,
    refetchInterval: 5000,
    staleTime: 0,
  });


  // Calculate progress for each project
  const projectsWithProgress = useMemo(() => {
    return projects.map(project => {
      const projectStories = allStories.filter(s => s.project_id === project.id);


      if (!projectStories.length) {
        return { ...project, calculatedProgress: project.progress || 0 };
      }

      const totalPoints = projectStories.reduce((sum, story) => sum + (Number(story.story_points) || 0), 0);

      if (totalPoints === 0) {
        return { ...project, calculatedProgress: 0 };
      }

      const completedPoints = projectStories
        .filter(s => {
          const status = (s.status || '').toLowerCase();
          return status === 'done' || status === 'completed';
        })
        .reduce((sum, story) => sum + (Number(story.story_points) || 0), 0);

      const calculatedProgress = Math.round((completedPoints / totalPoints) * 100);
      return { ...project, calculatedProgress };
    });
  }, [projects, allStories]);

  const getWorkspaceName = (workspaceId) => {
    if (!workspaceId) return null;
    const workspace = workspaces.find(ws => ws.id === workspaceId);
    return workspace?.name;
  };

  if (loading) {
    return (
      <Card className="bg-white border-0 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-100/80 rounded-[28px] overflow-hidden">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-[17px] font-semibold text-slate-900 tracking-tight">Recent Projects</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-[20px]" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-0 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-100/80 rounded-[28px] overflow-hidden">
      <CardHeader className="p-6 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-[17px] font-semibold text-slate-900 tracking-tight">Recent Projects</CardTitle>
        <Link to={createPageUrl("Projects")} className="text-[13px] font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="p-6 pt-2 space-y-4">
        {projects.length === 0 ? (
          <div className="text-center py-12 bg-slate-50/50 rounded-[20px]">
            <p className="text-[14px] text-slate-500 font-medium">No projects yet. Create your first project!</p>
          </div>
        ) : (
          projectsWithProgress.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link to={`${createPageUrl("ProjectDetail")}?id=${project.id}`}>
                {/* Flat Apple Style Row */}
                <div className="group block p-5 rounded-[20px] bg-[#f8f9fa] hover:bg-slate-100/70 transition-colors duration-300">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0 pr-4">
                      <h3 className="text-[15px] font-semibold text-slate-900 mb-0.5 truncate group-hover:text-indigo-600 transition-colors">
                        {project.name}
                      </h3>
                      <p className="text-[13px] text-slate-500 line-clamp-1">{project.description}</p>
                      {getWorkspaceName(project.workspace_id) && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Folder className="h-3 w-3 text-slate-400" />
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            {getWorkspaceName(project.workspace_id)}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Minimal Status Badge */}
                    <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${project.status === 'active' ? 'bg-indigo-100/50 text-indigo-700' :
                        project.status === 'completed' ? 'bg-emerald-100/50 text-emerald-700' :
                          project.status === 'on_hold' ? 'bg-amber-100/50 text-amber-700' :
                            'bg-slate-200/50 text-slate-600'
                      }`}>
                      {project.status.replace('_', ' ')}
                    </div>
                  </div>

                  {/* Progress Section */}
                  <div className="mt-4 space-y-1.5">
                    {/* Themed Custom Progress Bar */}
                    <div className="h-1.5 w-full bg-slate-200/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${project.status === 'completed' || project.calculatedProgress === 100
                            ? 'bg-emerald-500'
                            : 'bg-indigo-600'
                          }`}
                        style={{ width: `${project.calculatedProgress || 0}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[12px] font-medium text-slate-500">
                      <span>{project.calculatedProgress || 0}% complete</span>
                      {project.deadline && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {format(new Date(project.deadline), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

