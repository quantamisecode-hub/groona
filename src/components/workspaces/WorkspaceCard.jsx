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
    blue: { bg: "bg-blue-50", text: "text-blue-600" },
    green: { bg: "bg-emerald-50", text: "text-emerald-600" },
    purple: { bg: "bg-purple-50", text: "text-purple-600" },
    orange: { bg: "bg-orange-50", text: "text-orange-600" },
    red: { bg: "bg-rose-50", text: "text-rose-600" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
    teal: { bg: "bg-teal-50", text: "text-teal-600" },
    pink: { bg: "bg-pink-50", text: "text-pink-600" },
  };

  const themeColors = colorClasses[workspace.color] || colorClasses.blue;
  const isOwner = workspace.owner_email === currentUser?.email;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.is_super_admin;
  const isProjectManager = currentUser?.custom_role === 'project_manager';
  // Project managers cannot manage workspaces (edit, delete, manage members)
  const canManage = (isOwner || isAdmin) && !isProjectManager;

  const memberRole = workspace.members?.find(m => m.user_email === currentUser?.email)?.role;

  return (
    <Card
      className={`cursor-pointer transition-all bg-white border-zinc-200/80 rounded-2xl hover:shadow-md hover:border-zinc-300 ${isSelected ? 'ring-2 ring-zinc-900 shadow-md' : 'shadow-sm'
        }`}
      onClick={onSelect}
    >
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`h-12 w-12 rounded-2xl ${themeColors.bg} flex items-center justify-center shrink-0`}>
            <Folder className={`h-6 w-6 ${themeColors.text}`} strokeWidth={1.5} />
          </div>

          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full">
                  <MoreVertical className="h-5 w-5" strokeWidth={1.5} />
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
            <h3 className="font-semibold text-zinc-900 text-lg mb-1 flex items-center gap-2 tracking-tight">
              {workspace.name}
              {workspace.is_default && (
                <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-[10px] font-medium uppercase tracking-wider">Default</span>
              )}
            </h3>
            {workspace.description && (
              <p className="text-sm text-zinc-500 line-clamp-2 mt-1">{workspace.description}</p>
            )}
          </div>

          <div className="flex items-center gap-4 text-[13px] text-zinc-500 font-medium mt-4">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" strokeWidth={1.5} />
              <span>{workspace.members?.length || 0} members</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FolderKanban className="h-4 w-4" strokeWidth={1.5} />
              <span>{projectCount} {projectCount === 1 ? 'project' : 'projects'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-100 mt-2">
            <div className="flex items-center gap-2">
              {isOwner ? (
                <span className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700 text-[11px] font-medium">Owner</span>
              ) : memberRole ? (
                <span className="px-2.5 py-1 rounded-lg border border-zinc-200 text-zinc-600 text-[11px] font-medium capitalize">{memberRole}</span>
              ) : null}
              {workspace.status === 'archived' && (
                <span className="px-2.5 py-1 rounded-lg border border-zinc-200 text-zinc-500 text-[11px] font-medium">Archived</span>
              )}
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">
              by {workspace.owner_name}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}