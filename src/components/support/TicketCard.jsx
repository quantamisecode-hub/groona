import React from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, AlertCircle, CheckCircle2, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function TicketCard({ ticket, viewType = "user", onClick }) {
  const getStatusColor = (status = "") => {
    switch (status.toUpperCase()) {
      case "OPEN": return "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200";
      case "IN PROGRESS":
      case "IN_PROGRESS": return "bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200";
      case "WAITING":
      case "ESCALATED": return "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200";
      case "RESOLVED": return "bg-green-100 text-green-700 hover:bg-green-200 border-green-200";
      case "CLOSED": return "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const getPriorityColor = (priority = "") => {
    switch (priority.toUpperCase()) {
      case "HIGH": return "text-red-600 bg-red-50 border-red-100";
      case "CRITICAL": return "text-red-700 bg-red-100 border-red-200 font-bold";
      case "MEDIUM": return "text-amber-600 bg-amber-50 border-amber-100";
      case "LOW": return "text-blue-600 bg-blue-50 border-blue-100";
      default: return "text-slate-600 bg-slate-50";
    }
  };

  const deadline = ticket.slaDeadline || ticket.sla_deadline;
  const isBreached = ticket.sla_breached || (deadline && new Date(deadline) < new Date() && ticket.status?.toUpperCase() !== 'RESOLVED' && ticket.status?.toUpperCase() !== 'CLOSED');

  return (
    <div
      onClick={onClick}
      className={`block group ${onClick ? 'cursor-pointer' : ''}`}
    >
      <Card className={`transition-all duration-200 hover:shadow-md border-l-4 ${isBreached ? 'border-l-red-500' : 'border-l-transparent hover:border-l-blue-500'}`}>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs text-slate-500">#{ticket.ticket_number || (ticket._id ? ticket._id.toString().slice(-6).toUpperCase() : (ticket.id ? ticket.id.toString().slice(-6).toUpperCase() : 'TKT'))}</span>
                <Badge variant="outline" className={`${getPriorityColor(ticket.priority)} border`}>
                  {ticket.priority}
                </Badge>
                {ticket.complexity && (
                  <Badge variant="outline" className="text-slate-500 border-slate-200">
                    {ticket.complexity} Complexity
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-lg text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                {ticket.title}
              </h3>
              <p className="text-sm text-slate-500 line-clamp-2">{ticket.description}</p>
            </div>

            <div className="flex flex-col items-end gap-3 min-w-[140px]">
              <Badge className={`${getStatusColor(ticket.status)} px-3 py-1`}>
                {ticket.status ? ticket.status.replace("_", " ") : 'Unknown'}
              </Badge>

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {(ticket.created_date || ticket.createdAt) && !isNaN(new Date(ticket.created_date || ticket.createdAt).getTime())
                    ? `${formatDistanceToNow(new Date(ticket.created_date || ticket.createdAt))} ago`
                    : 'Recently'}
                </span>
              </div>

              {deadline && !isNaN(new Date(deadline).getTime()) && ticket.status?.toUpperCase() !== 'RESOLVED' && ticket.status?.toUpperCase() !== 'CLOSED' && (
                <div className={`flex items-center gap-1.5 text-xs font-medium ${isBreached ? 'text-red-600' : 'text-emerald-600'}`}>
                  {isBreached ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  {isBreached ? 'Overdue' : `Due ${formatDistanceToNow(new Date(deadline), { addSuffix: true })}`}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
