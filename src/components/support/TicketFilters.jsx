import React from "react";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function TicketFilters({ filters, onFilterChange }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 text-slate-600 font-medium mr-2">
        <Filter className="h-4 w-4" />
        Filters:
      </div>
      
      <Select 
        value={filters.status} 
        onValueChange={(val) => onFilterChange("status", val)}
      >
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="OPEN">Open</SelectItem>
          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
          <SelectItem value="WAITING">Waiting</SelectItem>
          <SelectItem value="RESOLVED">Resolved</SelectItem>
          <SelectItem value="CLOSED">Closed</SelectItem>
        </SelectContent>
      </Select>

      <Select 
        value={filters.complexity} 
        onValueChange={(val) => onFilterChange("complexity", val)}
      >
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue placeholder="Complexity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Complexities</SelectItem>
          <SelectItem value="LOW">Low</SelectItem>
          <SelectItem value="MEDIUM">Medium</SelectItem>
          <SelectItem value="HIGH">High</SelectItem>
        </SelectContent>
      </Select>

      {/* Reset Filter Button */}
      {(filters.status !== "all" || filters.complexity !== "all") && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => {
            onFilterChange("status", "all");
            onFilterChange("complexity", "all");
          }}
          className="ml-auto h-9 text-slate-500 hover:text-slate-900"
        >
          Clear Filters
        </Button>
      )}
    </div>
  );
}