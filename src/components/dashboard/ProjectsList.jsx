import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ArrowRight, Folder, Image as ImageIcon } from "lucide-react";
import { format, differenceInDays } from "date-fns";
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

export default function ProjectsList({ projects, stories = [], loading }) {
  const [filterMode, setFilterMode] = useState("recent");

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => groonabackend.entities.Workspace.list(),
  });

  // Calculate progress for each project
  const projectsWithProgress = useMemo(() => {
    return projects.map(project => {
      const projectStories = stories.filter(s => s.project_id === project.id);


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
  }, [projects, stories]);

  // Sort projects based on selected filter
  const sortedProjects = useMemo(() => {
    let sorted = [...projectsWithProgress];

    switch (filterMode) {
      case "top":
        sorted.sort((a, b) => b.calculatedProgress - a.calculatedProgress || new Date(b.created_date || 0) - new Date(a.created_date || 0));
        break;
      case "attention":
        sorted.sort((a, b) => a.calculatedProgress - b.calculatedProgress || new Date(b.created_date || 0) - new Date(a.created_date || 0));
        break;
      case "recent":
      default:
        // Assume they come sorted by recent from the API loosely, or sort explicitly by created_date/updated_date
        sorted.sort((a, b) => new Date(b.created_date || b.updated_date || 0) - new Date(a.created_date || a.updated_date || 0));
        break;
    }

    return sorted;
  }, [projectsWithProgress, filterMode]);

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
        <div className="flex items-center gap-3">
          <CardTitle className="text-[17px] font-semibold text-slate-900 tracking-tight">
            {filterMode === "top" ? "Top Projects" : filterMode === "attention" ? "Needs Attention" : "Recent Projects"}
          </CardTitle>
        </div>

        <div className="flex items-center gap-3">
          <Select value={filterMode} onValueChange={setFilterMode}>
            <SelectTrigger className="h-8 border-slate-200 bg-white text-xs font-medium w-[140px] rounded-lg shadow-sm">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent" className="text-xs">Recent</SelectItem>
              <SelectItem value="top" className="text-xs">Top Performing</SelectItem>
              <SelectItem value="attention" className="text-xs">Needs Attention</SelectItem>
            </SelectContent>
          </Select>
          <Link to={createPageUrl("Projects")} className="text-[13px] font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-2 space-y-4">
        {projects.length === 0 ? (
          <div className="text-center py-12 bg-slate-50/50 rounded-[20px]">
            <p className="text-[14px] text-slate-500 font-medium">No projects found.</p>
          </div>
        ) : (
          sortedProjects.slice(0, 5).map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link to={`${createPageUrl("ProjectDetail")}?id=${project.id}`}>
                <div className="group flex flex-col sm:flex-row bg-[#fdfdfd] border border-slate-200 rounded-[14px] overflow-hidden hover:shadow-md transition-all duration-300">
                  {/* Left Column: Image or Fallback Gradient */}
                  <div
                    className={`w-full sm:w-[200px] h-32 sm:h-auto shrink-0 relative bg-gradient-to-br ${!project.logo_url ? 'from-[#bad5de] to-[#a2c8d6]' : 'bg-cover bg-center'}`}
                    style={project.logo_url ? { backgroundImage: `url(${project.logo_url})` } : {}}
                  />

                  {/* Right Column: Project Details */}
                  <div className="flex-1 p-5 flex flex-col justify-between">
                    <div>
                      {/* Top Header Row */}
                      <div className="flex items-center justify-between mb-3">
                        <div className={`px-2.5 py-1 rounded-[6px] text-[11px] font-bold uppercase tracking-wider ${project.status === 'active' ? 'bg-[#eef2fe] text-[#2c65f6]' :
                          project.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                            project.status === 'on_hold' ? 'bg-amber-50 text-amber-700' :
                              'bg-slate-50 text-slate-600'
                          }`}>
                          {project.status.replace('_', ' ')} PROJECT
                        </div>

                        <span className="text-[14px] text-[#8ea0b3] font-medium tracking-tight">
                          {project.deadline ? (
                            (() => {
                              const days = differenceInDays(new Date(project.deadline), new Date());
                              if (days < 0) return `Overdue by ${Math.abs(days)} days`;
                              if (days === 0) return 'Due today';
                              return `Due in ${days} days`;
                            })()
                          ) : (
                            "No deadline"
                          )}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-[20px] font-extrabold text-[#111827] leading-tight mb-2 group-hover:text-[#2c65f6] transition-colors">
                        {project.name}
                      </h3>
                      <p
                        className="text-[14px] text-[#5b6b82] line-clamp-2 leading-relaxed font-medium"
                        dangerouslySetInnerHTML={{
                          __html: (project.description || "No description provided.")
                            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900">$1</strong>')
                        }}
                      />
                    </div>

                    {/* Progress & Bottom Row */}
                    <div className="mt-5">
                      <div className="flex items-center justify-between mb-2 text-[15px]">
                        <span className="text-[#111827] font-bold">Overall Completion</span>
                        <span className="text-[#2c65f6] font-extrabold">{project.calculatedProgress || 0}%</span>
                      </div>

                      <div className="h-[10px] w-full bg-[#f1f5f9] rounded-full overflow-hidden mb-5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${project.status === 'completed' || project.calculatedProgress === 100
                            ? 'bg-emerald-500'
                            : 'bg-[#2c65f6]'
                            }`}
                          style={{ width: `${project.calculatedProgress || 0}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[14px]">
                        <span className="text-[#5b6b82] font-medium">
                          {getWorkspaceName(project.workspace_id)
                            ? `Workspace: ${getWorkspaceName(project.workspace_id)}`
                            : "Next Milestone: Unknown"}
                        </span>
                        <span className="text-[#2c65f6] font-bold hover:underline cursor-pointer tracking-tight">
                          View Roadmap
                        </span>
                      </div>
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

