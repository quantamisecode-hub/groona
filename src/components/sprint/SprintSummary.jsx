import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MoreVertical, Lock, Play, Download, Edit, Copy, Trash2, CheckCircle, ChevronLeft, Loader2, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { toast } from "sonner";

const statusColors = {
  draft: "bg-slate-100 text-slate-700",
  planned: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-700",
};

export default function SprintSummary({ 
  sprint, 
  totalPoints, 
  capacity = 100, 
  onUpdate, 
  onLock, 
  onStart, 
  onExport, 
  onBack,
  isUpdating = false 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(sprint.name);
  const [editGoal, setEditGoal] = useState(sprint.goal);

  const handleSave = () => {
    onUpdate({ name: editName, goal: editGoal });
    setIsEditing(false);
  };

  const capacityPercentage = Math.min(100, Math.round((totalPoints / capacity) * 100));
  const capacityColor = capacityPercentage > 100 ? 'bg-red-500' : capacityPercentage > 80 ? 'bg-amber-500' : 'bg-green-500';

  // Helper to safely get status
  const currentStatus = sprint.status || 'draft';
  const isLocked = !!sprint.locked_date; 

  return (
    <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10 shadow-sm">
      <div className="flex flex-col gap-4 max-w-full">
        {/* Top Row: Back, Title/Edit, Status, Actions */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="mr-1">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)} 
                    className="h-8 font-bold text-lg w-64"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">{sprint.name}</h1>
                  <Badge variant="outline" className={`${statusColors[currentStatus] || statusColors.draft} capitalize border-0`}>
                    {currentStatus}
                  </Badge>
                  
                  {/* VISUAL FIX: Show Badge if locked */}
                  {isLocked && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Scope Locked
                    </Badge>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                <span>{format(new Date(sprint.start_date), 'MMM d')} - {format(new Date(sprint.end_date), 'MMM d')}</span>
                {isEditing ? (
                  <Input 
                    value={editGoal} 
                    onChange={(e) => setEditGoal(e.target.value)} 
                    className="h-6 text-sm w-96"
                    placeholder="Sprint Goal..."
                  />
                ) : (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="italic truncate max-w-md">{sprint.goal || "No goal set"}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} disabled={isUpdating}>Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={isUpdating}>
                  {isUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-2"/> : null}
                  Save
                </Button>
              </>
            ) : (
              <>
                {/* Lock Button (Draft or Planned) */}
                {(currentStatus === 'draft' || currentStatus === 'planned') && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={onLock} 
                    className="gap-2"
                    disabled={isUpdating}
                    title={isLocked ? `Locked on ${new Date(sprint.locked_date).toLocaleDateString()}` : "Lock scope"}
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    {isLocked ? 'Update Scope Lock' : 'Lock Sprint'}
                  </Button>
                )}
                
                {/* Start Sprint Button (Planned Only) */}
                {currentStatus === 'planned' && (
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700 gap-2" 
                    onClick={onStart}
                    disabled={isUpdating}
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Start Sprint
                  </Button>
                )}

                {/* Export Button (Non-Draft) */}
                {currentStatus !== 'draft' && (
                  <Button size="sm" variant="outline" onClick={onExport} className="gap-2">
                    <Download className="h-4 w-4" /> Export Summary
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Edit className="h-4 w-4 mr-2" /> Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Copy className="h-4 w-4 mr-2" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        {/* Bottom Row: Capacity Bar */}
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-lg border border-slate-100">
          <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
            Capacity: {totalPoints} / {capacity} pts
          </span>
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${capacityColor}`} 
              style={{ width: `${capacityPercentage}%` }} 
            />
          </div>
          <span className={`text-xs font-bold ${capacityPercentage > 100 ? 'text-red-600' : 'text-slate-500'}`}>
            {capacityPercentage}%
          </span>
        </div>
      </div>
    </div>
  );
}