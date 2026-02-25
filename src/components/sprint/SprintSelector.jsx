import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function SprintSelector({ 
  sprints = [], 
  selectedSprintId, 
  onSprintChange, 
  onCreateNew,
  disabled = false 
}) {
  return (
    <div className="flex gap-2">
      <Select value={selectedSprintId} onValueChange={onSprintChange} disabled={disabled}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder={disabled ? "Select project first" : "Select a sprint..."} />
        </SelectTrigger>
        <SelectContent>
          {sprints.length === 0 ? (
            <SelectItem value="no-sprints" disabled>
              No sprints available
            </SelectItem>
          ) : (
            sprints.map(sprint => (
              <SelectItem key={sprint.id} value={sprint.id}>
                {sprint.name} - {sprint.status}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      <Button
        onClick={onCreateNew}
        disabled={disabled}
        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
      >
        <Plus className="h-4 w-4 mr-2" />
        New Sprint
      </Button>
    </div>
  );
}