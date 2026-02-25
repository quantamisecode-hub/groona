import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Folder, MoreVertical, Users, FolderKanban, Edit, Trash2, Archive, UserPlus, RotateCcw } from "lucide-react";

export default function WorkspaceCard({ workspace, onEdit, onDelete, onManageMembers, onSelect, isSelected, currentUser, projectCount = 0 }) {
  const colorClasses = {
    blue: "from-blue-500 to-cyan-500",
    green: "from-green-500 to-emerald-500",
    purple: "from-purple-500 to-pink-500",
    orange: "from-orange-500 to-amber-500",
    red: "from-red-500 to-rose-500",
    indigo: "from-indigo-500 to-purple-500",
    teal: "from-teal-500 to-cyan-500",
    pink: "from-pink-500 to-rose-500",
  };

  const gradientClass = colorClasses[workspace.color] || colorClasses.blue;
  const isOwner = workspace.owner_email === currentUser?.email;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.is_super_admin;
  const isProjectManager = currentUser?.custom_role === 'project_manager';
  // Project managers cannot manage workspaces (edit, delete, manage members)
  const canManage = (isOwner || isAdmin) && !isProjectManager;

  const memberRole = workspace.members?.find(m => m.user_email === currentUser?.email)?.role;

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-lg ${
        isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
      }`}
      onClick={onSelect}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center shadow-lg`}>
            <Folder className="h-6 w-6 text-white" />
          </div>
          
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(workspace); }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Workspace
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onManageMembers(workspace); }}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Manage Members
                </DropdownMenuItem>
                
                {/* Archive Option (Only for Active) */}
                {(workspace.status === 'active' || !workspace.status) && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(workspace, 'archive'); }}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                )}

                {/* Restore Option (Only for Archived) - ADDED THIS */}
                {workspace.status === 'archived' && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(workspace, 'restore'); }}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Restore
                  </DropdownMenuItem>
                )}

                {isAdmin && (
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onDelete(workspace, 'delete'); }}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-slate-900 text-lg mb-1 flex items-center gap-2">
              {workspace.name}
              {workspace.is_default && (
                <Badge className="bg-blue-100 text-blue-700 text-xs">Default</Badge>
              )}
            </h3>
            {workspace.description && (
              <p className="text-sm text-slate-600 line-clamp-2">{workspace.description}</p>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{workspace.members?.length || 0} members</span>
            </div>
            <div className="flex items-center gap-1">
              <FolderKanban className="h-4 w-4" />
              <span>{projectCount} {projectCount === 1 ? 'project' : 'projects'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-2">
              {isOwner ? (
                <Badge className="bg-amber-100 text-amber-700 text-xs">Owner</Badge>
              ) : memberRole ? (
                <Badge variant="outline" className="text-xs capitalize">{memberRole}</Badge>
              ) : null}
              {workspace.status === 'archived' && (
                <Badge variant="outline" className="text-xs">Archived</Badge>
              )}
            </div>
            <span className="text-xs text-slate-500">
              by {workspace.owner_name}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}