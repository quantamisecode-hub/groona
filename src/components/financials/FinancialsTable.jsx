import React from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Edit2, TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function FinancialsTable({ projects, onEdit, currency = "USD" }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount || 0);
  };

  const calculateProfit = (revenue, cost) => {
    return (revenue || 0) - (cost || 0);
  };

  const calculateMargin = (revenue, cost) => {
    if (!revenue) return 0;
    const profit = calculateProfit(revenue, cost);
    return (profit / revenue) * 100;
  };

  const getProfitabilityStatus = (revenue, cost) => {
    const profit = calculateProfit(revenue, cost);
    if (profit > 0) return { label: "Profitable", color: "bg-green-100 text-green-800" };
    if (profit < 0) return { label: "Loss", color: "bg-red-100 text-red-800" };
    return { label: "Break-even", color: "bg-gray-100 text-gray-800" };
  };

  return (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="w-[200px]">Project Name</TableHead>
            <TableHead>Budget</TableHead>
            <TableHead>Actual Cost</TableHead>
            <TableHead>Expected Revenue</TableHead>
            <TableHead>Actual Revenue</TableHead>
            <TableHead>Profit/Loss</TableHead>
            <TableHead>Margin</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const profit = calculateProfit(project.actual_revenue, project.actual_cost);
            const margin = calculateMargin(project.actual_revenue, project.actual_cost);
            const status = getProfitabilityStatus(project.actual_revenue, project.actual_cost);
            
            return (
              <TableRow key={project.id} className="hover:bg-slate-50/50">
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span>{project.name}</span>
                    <span className="text-xs text-slate-500 truncate max-w-[180px]">
                      {project.client || "Internal"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{formatCurrency(project.budget)}</TableCell>
                <TableCell>
                  <span className={project.actual_cost > project.budget ? "text-red-600 font-medium" : ""}>
                    {formatCurrency(project.actual_cost)}
                  </span>
                  {project.budget > 0 && (
                    <Progress 
                      value={Math.min((project.actual_cost / project.budget) * 100, 100)} 
                      className={`h-1.5 mt-1 w-24 ${
                        project.actual_cost > project.budget ? "bg-red-200" : ""
                      }`}
                    />
                  )}
                </TableCell>
                <TableCell>{formatCurrency(project.expected_revenue)}</TableCell>
                <TableCell>{formatCurrency(project.actual_revenue)}</TableCell>
                <TableCell>
                  <div className={`flex items-center gap-1 font-medium ${
                    profit > 0 ? "text-green-600" : profit < 0 ? "text-red-600" : "text-slate-600"
                  }`}>
                    {profit > 0 ? <TrendingUp className="w-3 h-3" /> : 
                     profit < 0 ? <TrendingDown className="w-3 h-3" /> : 
                     <Minus className="w-3 h-3" />}
                    {formatCurrency(profit)}
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    margin >= 20 ? "bg-green-50 text-green-700" :
                    margin > 0 ? "bg-yellow-50 text-yellow-700" :
                    "bg-red-50 text-red-700"
                  }`}>
                    {margin.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell>
                  <Badge className={status.color} variant="secondary">
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(project)}
                    className="h-8 w-8"
                  >
                    <Edit2 className="w-4 h-4 text-slate-500" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {projects.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-slate-500">
                No projects found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
