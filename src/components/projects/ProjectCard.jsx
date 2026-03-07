import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, Trash2, FolderKanban } from "lucide-react";
import { format } from "date-fns";
import { PermissionGuard } from "../shared/PermissionGuard";
import { useQuery } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";
import { Checkbox } from "@/components/ui/checkbox";

const statusColors = {
  planning: "bg-purple-50 text-purple-700 border-purple-100",
  active: "bg-blue-50 text-blue-700 border-blue-100",
  on_hold: "bg-amber-50 text-amber-700 border-amber-100",
  completed: "bg-green-50 text-green-700 border-green-100",
};

const priorityColors = {
  low: "bg-zinc-100 text-zinc-600 border-zinc-200",
  medium: "bg-blue-50 text-blue-600 border-blue-100",
  high: "bg-orange-50 text-orange-600 border-orange-100",
  urgent: "bg-red-50 text-red-600 border-red-100",
};

export default function ProjectCard({ project, onDelete, highlighted }) {
  // Use backend calculated health score
  const healthScore = useMemo(() => {
    return project.health_score !== undefined ? project.health_score : 100;
  }, [project.health_score]);


  const isYellow = healthScore >= 50 && healthScore < 70;
  const isRed = healthScore < 50;

  const getProjectInitials = (name) => {
    if (!name) return 'PR';
    const splitName = name.split(' ');
    if (splitName.length >= 2) {
      return (splitName[0][0] + splitName[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getUserInitials = (name) => {
    if (!name) return 'U';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    return initials.slice(0, 2) || 'U';
  };

  // Fetch users to display avatars
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => groonabackend.entities.User.list(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch stories to calculate progress based on Story Points with partial completion
  const { data: stories = [] } = useQuery({
    queryKey: ['stories', project.id],
    queryFn: async () => {
      if (!project.id) return [];
      return await groonabackend.entities.Story.filter({ project_id: project.id });
    },
    enabled: !!project.id,
    refetchInterval: 5000,
    staleTime: 0,
  });


  // Calculate project progress based on Story Points (Strict: Completed / Total)
  const projectProgress = useMemo(() => {
    if (!stories.length) return project.progress || 0;

    const totalPoints = stories.reduce((sum, story) => sum + (Number(story.story_points) || 0), 0);

    if (totalPoints === 0) return 0;

    const completedPoints = stories
      .filter(s => {
        const status = (s.status || '').toLowerCase();
        return status === 'done' || status === 'completed';
      })
      .reduce((sum, story) => sum + (Number(story.story_points) || 0), 0);

    return Math.round((completedPoints / totalPoints) * 100);
  }, [stories, project.progress]);

  // Status and color mapping for the new design
  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'active' || s === 'planning') return 'bg-blue-500';
    if (s === 'on_hold') return 'bg-orange-500';
    if (s === 'completed') return 'bg-green-500';
    return 'bg-zinc-400';
  };

  const getProgressStyles = (progress) => {
    if (progress >= 80) return { color: 'bg-green-500', shadow: 'shadow-[0_0_8px_rgba(34,197,94,0.25)]', track: 'bg-green-50' };
    if (progress >= 30) return { color: 'bg-yellow-500', shadow: 'shadow-[0_0_8px_rgba(234,179,8,0.25)]', track: 'bg-yellow-50' };
    return { color: 'bg-red-500', shadow: 'shadow-[0_0_8px_rgba(239,68,68,0.25)]', track: 'bg-red-50' };
  };

  const progressStyles = getProgressStyles(projectProgress);

  return (
    <Card className="group relative bg-white border border-zinc-200/60 rounded-[20px] shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300 h-full overflow-hidden">
      <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)} className="flex flex-col h-full p-6">
        {/* Header section: Icon + Title + Badges */}
        <div className="flex gap-4 mb-4">
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center overflow-hidden">
              {project.logo_url ? (
                <img src={project.logo_url} alt={project.name} className="w-10 h-10 object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-blue-600 font-bold bg-blue-50 text-xl uppercase tracking-tighter">
                  {getProjectInitials(project.name)}
                </div>
              )}
            </div>
            {/* Status Dot */}
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(project.status)} shadow-sm z-10`} />
          </div>

          <div className="flex flex-col flex-1 min-w-0">
            <h3 className="text-[17px] font-bold text-zinc-900 truncate group-hover:text-blue-600 transition-colors">
              {project.name}
            </h3>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <Badge variant="secondary" className={`${statusColors[project.status.toLowerCase()] || "bg-zinc-100 text-zinc-600"} border font-semibold px-2.5 py-0.5 rounded-md capitalize text-[10px] shadow-none pointer-events-none tracking-wide text-nowrap`}>
                {project.status.split('_').join(' ')}
              </Badge>
              {project.priority && (
                <Badge variant="secondary" className={`${priorityColors[project.priority.toLowerCase()] || "bg-zinc-100 text-zinc-600"} border font-semibold px-2.5 py-0.5 rounded-md capitalize text-[10px] shadow-none pointer-events-none tracking-wide text-nowrap`}>
                  {project.priority}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Description section */}
        <div className="flex flex-col gap-1 mb-6">
          <p className="text-zinc-500 text-[13px] font-medium truncate">
            {project.tagline || 'Project management'}
          </p>
          <p className="text-zinc-500 text-[13px] line-clamp-2 leading-relaxed">
            {project.description || 'No description provided for this project.'}
          </p>
        </div>

        {/* Progress section */}
        <div className="mt-auto pt-4">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-[13px] font-semibold text-zinc-400">Progress</span>
            <span className="text-[13px] font-bold text-zinc-900">{projectProgress}%</span>
          </div>
          <div className={`w-full ${progressStyles.track} h-2.5 rounded-full overflow-hidden`}>
            <div
              className={`h-full ${progressStyles.color} rounded-full transition-all duration-500 ease-out ${progressStyles.shadow}`}
              style={{ width: `${projectProgress}%` }}
            />
          </div>
        </div>

        {/* Date section */}
        <div className="mt-6 flex items-center gap-2 text-zinc-500">
          <Calendar className="w-4 h-4 text-zinc-400" />
          <span className="text-[13px] font-medium">
            Due {project.deadline ? format(new Date(project.deadline), 'MMM d, yyyy') : 'TBD'}
          </span>
        </div>

        {/* Team section (Footer) */}
        <div className="mt-6 flex items-center h-8">
          {project.team_members && project.team_members.length > 0 ? (
            <div className="flex -space-x-2">
              {project.team_members.slice(0, 4).map((member, idx) => {
                const user = users.find(u => u.email === member.email);
                return (
                  <Avatar key={idx} className="h-8 w-8 border-2 border-white shadow-sm">
                    <AvatarImage src={user?.profile_image_url} />
                    <AvatarFallback className="text-[10px] bg-zinc-100 text-zinc-600 font-bold">
                      {getUserInitials(user?.full_name || member.email)}
                    </AvatarFallback>
                  </Avatar>
                );
              })}
              {project.team_members.length > 4 && (
                <div className="h-8 w-8 rounded-full bg-zinc-50 border-2 border-white flex items-center justify-center text-[10px] font-bold text-zinc-600 shadow-sm shrink-0">
                  +{project.team_members.length - 4}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-8 flex items-center">
              <span className="text-zinc-400 text-[11px] font-medium italic">Unassigned</span>
            </div>
          )}
        </div>
      </Link>

      {/* Delete Action (Hidden by default, shows on hover or with permission) */}
      <PermissionGuard permissionKey="can_delete_project">
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(project.id);
            }}
            className="h-8 w-8 rounded-full text-zinc-400 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </PermissionGuard>
    </Card>
  );
}
