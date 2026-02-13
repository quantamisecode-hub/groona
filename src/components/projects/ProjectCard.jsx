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

const statusColors = {
  planning: "bg-blue-100 text-blue-700 border-blue-200",
  active: "bg-green-100 text-green-700 border-green-200",
  on_hold: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-slate-100 text-slate-700 border-slate-200",
};

const priorityColors = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export default function ProjectCard({ project, onDelete }) {
  const getProjectInitials = (name) => {
    if (!name) return 'PR';
    const initials = name.split(' ').map(word => word[0]).join('').toUpperCase();
    return initials.slice(0, 2) || 'PR';
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

  return (
    <Card
      className="group hover:shadow-xl transition-all duration-300 bg-white/60 backdrop-blur-xl border-slate-200/60 overflow-hidden"
      style={{ borderTopColor: project.color || '#3b82f6', borderTopWidth: '4px' }}
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          {/* Project Logo/Avatar */}
          <Avatar className="h-12 w-12 border-2 border-white shadow-md">
            {project.logo_url ? (
              <AvatarImage src={project.logo_url} alt={project.name} />
            ) : (
              <AvatarFallback
                className="text-white font-bold text-sm"
                style={{ background: `linear-gradient(135deg, ${project.color || '#3b82f6'}, ${project.color || '#3b82f6'}dd)` }}
              >
                {getProjectInitials(project.name)}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="flex-1 min-w-0">
            <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)} className="block">
              <CardTitle className="group-hover:text-blue-600 transition-colors line-clamp-2 text-lg">
                {project.name}
              </CardTitle>
            </Link>
            <div className="flex gap-2 flex-wrap mt-2">
              <Badge className={`${statusColors[project.status]} border text-xs`}>
                {project.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </Badge>
              {project.priority && (
                <Badge className={`${priorityColors[project.priority]} text-xs`}>
                  {project.priority.charAt(0).toUpperCase() + project.priority.slice(1)}
                </Badge>
              )}
            </div>
          </div>

          <PermissionGuard permissionKey="can_delete_project">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(project.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </PermissionGuard>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {project.description && (
          <p className="text-slate-600 text-sm line-clamp-2">{project.description}</p>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Progress</span>
            <span className="font-semibold text-slate-900">{projectProgress}%</span>
          </div>
          <Progress value={projectProgress} className="h-2" />
        </div>

        {project.deadline && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="h-4 w-4" />
            <span>Due {format(new Date(project.deadline), 'MMM d, yyyy')}</span>
          </div>
        )}

        {project.team_members && project.team_members.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <TooltipProvider>
              <div className="flex -space-x-2">
                {project.team_members.slice(0, 4).map((member, idx) => {
                  const user = users.find(u => u.email === member.email);
                  return (
                    <Tooltip key={idx}>
                      <TooltipTrigger asChild>
                        <Avatar className="h-7 w-7 border-2 border-white ring-1 ring-slate-200 cursor-default hover:z-10 transition-all hover:scale-110">
                          <AvatarImage src={user?.profile_image_url} />
                          <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white font-medium">
                            {getUserInitials(user?.full_name || member.email)}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs font-medium">{user?.full_name || member.email}</p>
                        <p className="text-xs text-slate-500">{member.role}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
            {project.team_members.length > 4 && (
              <span className="text-xs text-slate-500 ml-1">
                +{project.team_members.length - 4} more
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

