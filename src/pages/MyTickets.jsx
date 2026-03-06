import { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Ticket, Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import TicketCard from "@/components/support/TicketCard";
import TicketFilters from "@/components/support/TicketFilters";
import ReportBugDialog from "@/components/support/ReportBugDialog";
import SupportTicketDialog from "@/components/support/SupportTicketDialog";
import { toast } from "sonner";
import { useUser } from "@/components/shared/UserContext";

export default function MyTickets() {
  const { user } = useUser();
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({
    status: "all"
  });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [breachedTicket, setBreachedTicket] = useState(null);
  const [showBreachModal, setShowBreachModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ["my-tickets", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      try {
        return await groonabackend.support.getExternalTickets(user.email);
      } catch (err) {
        console.error("Failed to fetch tickets from Support Portal:", err);
        return [];
      }
    },
    enabled: !!user?.email
  });

  const filteredTickets = tickets.filter(ticket => {
    // Support Portal uses 'Open', 'Resolved', etc.
    if (filters.status !== "all" &&
      (!ticket.status || ticket.status.toLowerCase() !== filters.status.toLowerCase())) {
      return false;
    }



    return true;
  });

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleTicketClick = (ticket) => {
    const isBreached = ticket.slaDeadline &&
      new Date(ticket.slaDeadline) < new Date() &&
      ticket.status !== 'Resolved' &&
      ticket.status !== 'Closed';

    if (isBreached) {
      setBreachedTicket(ticket);
      setShowBreachModal(true);
    } else {
      setSelectedTicket(ticket);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 shadow-xl mb-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">🎫 Support Center</h1>
                <p className="text-blue-100 opacity-90">Need help? We are here to assist you.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <TicketFilters filters={filters} onFilterChange={handleFilterChange} />
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
            <p className="text-slate-600 font-medium">Loading your tickets...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center border-2 border-dashed border-slate-200">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-50 mb-4">
              <Ticket className="h-8 w-8 text-blue-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {filters.status !== "all"
                ? "No tickets found matching filters"
                : "No support tickets yet"}
            </h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              {filters.status !== "all"
                ? "Try adjusting your search filters to find what you're looking for."
                : "Your support tickets will appear here once they are created."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTickets.map(ticket => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onClick={() => handleTicketClick(ticket)}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={showBreachModal} onOpenChange={setShowBreachModal}>
        <DialogContent className="max-w-md rounded-3xl p-8 border-none shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="h-20 w-20 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner">
              <AlertCircle className="h-10 w-10" />
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight tracking-tight leading-8 mb-2">Working on it!</h2>
              <p className="text-slate-500 font-medium leading-relaxed">
                We are currently working on this ticket to resolve it as soon as possible.
                Thank you for your patience while we prioritize your request.
              </p>
            </div>

            <Button
              onClick={() => {
                setShowBreachModal(false);
                setSelectedTicket(breachedTicket);
              }}
              className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-lg shadow-amber-100 transition-all font-bold"
            >
              Understand & View Details
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ReportBugDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          queryClient.invalidateQueries(["my-tickets"]);
        }}
      />

      <SupportTicketDialog
        open={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        ticket={selectedTicket}
        currentUser={{ ...user, full_name: user?.full_name || user?.name || "User" }}
        onUpdate={() => {
          queryClient.invalidateQueries(["my-tickets"]);
        }}
      />
    </div>
  );
}

