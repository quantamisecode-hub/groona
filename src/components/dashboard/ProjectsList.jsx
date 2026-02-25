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
      <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-bold text-slate-900">Recent Projects</CardTitle>
        <Link to={createPageUrl("Projects")} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">No projects yet. Create your first project!</p>
          </div>
        ) : (
          projectsWithProgress.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link to={`${createPageUrl("ProjectDetail")}?id=${project.id}`}>
                <div className="p-4 rounded-xl border border-slate-200/60 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 group cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                        {project.name}
                      </h3>
                      <p className="text-sm text-slate-600 line-clamp-1">{project.description}</p>
                      {getWorkspaceName(project.workspace_id) && (
                        <div className="flex items-center gap-1 mt-1">
                          <Folder className="h-3 w-3 text-slate-400" />
                          <span className="text-xs text-slate-500">
                            {getWorkspaceName(project.workspace_id)}
                          </span>
                        </div>
                      )}
                    </div>
                    <Badge className={`${statusColors[project.status]} border capitalize`}>
                      {project.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Progress value={project.calculatedProgress || 0} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{project.calculatedProgress || 0}% complete</span>
                      {project.deadline && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
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

