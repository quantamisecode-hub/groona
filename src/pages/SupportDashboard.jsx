import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LifeBuoy, Search, BarChart3, Ticket as TicketIcon, RefreshCw } from "lucide-react";
import TicketCard from "../components/support/TicketCard";
import TicketDetailDialog from "../components/support/TicketDetailDialog";
import SupportAnalytics from "../components/support/SupportAnalytics";

export default function SupportDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
    ? currentUser.active_tenant_id 
    : currentUser?.tenant_id;

  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ['support-tickets', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Ticket.filter({ tenant_id: effectiveTenantId }, '-created_date');
    },
    enabled: !!currentUser && !!effectiveTenantId,
  });

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ticket.ticket_number.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Group tickets by status
  const openTickets = filteredTickets.filter(t => ['open', 'reopened'].includes(t.status));
  const inProgressTickets = filteredTickets.filter(t => t.status === 'in_progress');
  const waitingTickets = filteredTickets.filter(t => t.status === 'waiting_response');
  const resolvedTickets = filteredTickets.filter(t => ['resolved', 'closed'].includes(t.status));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 flex items-center gap-3">
              <LifeBuoy className="h-8 w-8 text-blue-600" />
              Support Dashboard
            </h1>
            <p className="text-slate-600 mt-1">
              Manage and track all support tickets
            </p>
          </div>
          
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tickets" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="tickets" className="gap-2">
              <TicketIcon className="h-4 w-4" />
              Tickets ({tickets.length})
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Tickets Tab */}
          <TabsContent value="tickets" className="space-y-6 mt-6">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="waiting_response">Waiting Response</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="reopened">Reopened</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="All Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ticket Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Open & Reopened */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                  Open ({openTickets.length})
                </h3>
                <div className="space-y-3">
                  {openTickets.map(ticket => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onClick={() => setSelectedTicket(ticket)}
                    />
                  ))}
                  {openTickets.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-8">No open tickets</p>
                  )}
                </div>
              </div>

              {/* In Progress */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-purple-600"></span>
                  In Progress ({inProgressTickets.length})
                </h3>
                <div className="space-y-3">
                  {inProgressTickets.map(ticket => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onClick={() => setSelectedTicket(ticket)}
                    />
                  ))}
                  {inProgressTickets.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-8">No tickets in progress</p>
                  )}
                </div>
              </div>

              {/* Waiting Response */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-yellow-600"></span>
                  Waiting Response ({waitingTickets.length})
                </h3>
                <div className="space-y-3">
                  {waitingTickets.map(ticket => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onClick={() => setSelectedTicket(ticket)}
                    />
                  ))}
                  {waitingTickets.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-8">No waiting tickets</p>
                  )}
                </div>
              </div>

              {/* Resolved & Closed */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-600"></span>
                  Resolved ({resolvedTickets.length})
                </h3>
                <div className="space-y-3">
                  {resolvedTickets.map(ticket => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onClick={() => setSelectedTicket(ticket)}
                    />
                  ))}
                  {resolvedTickets.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-8">No resolved tickets</p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-6">
            <SupportAnalytics tickets={tickets} />
          </TabsContent>
        </Tabs>

        {/* Ticket Detail Dialog */}
        {selectedTicket && (
          <TicketDetailDialog
            open={!!selectedTicket}
            onClose={() => setSelectedTicket(null)}
            ticket={selectedTicket}
            onUpdate={() => refetch()}
            currentUser={currentUser}
          />
        )}
      </div>
    </div>
  );
}

