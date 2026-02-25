import { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Ticket, Loader2 } from "lucide-react";
import TicketCard from "@/components/support/TicketCard";
import TicketFilters from "@/components/support/TicketFilters";
import CreateTicketDialog from "@/components/support/CreateTicketDialog";
import { toast } from "sonner";
import { useUser } from "@/components/shared/UserContext";

export default function MyTickets() {
  const { user } = useUser();
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    complexity: "all"
  });
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["my-tickets", user?.email],
    queryFn: () => groonabackend.entities.Ticket.filter({ reporter_email: user?.email }, "-created_date"),
    enabled: !!user?.email
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Calculate SLA deadline based on complexity/priority
      // Default: Low=24h, Medium=12h, High=4h
      const hoursMap = { LOW: 24, MEDIUM: 12, HIGH: 4, CRITICAL: 1 };
      const hours = hoursMap[data.priority] || 24;
      const slaDeadline = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

      return groonabackend.entities.Ticket.create({
        ...data,
        tenant_id: user.tenant_id,
        reporter_email: user.email,
        reporter_name: user.full_name,
        reporter_role: user.role,
        status: "OPEN",
        sla_deadline: slaDeadline,
        sla_breached: false,
        created_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["my-tickets"]);
      setShowCreate(false);
      toast.success("Ticket created successfully! Our team will respond shortly.");
    },
    onError: (error) => {
      console.error("Ticket creation failed:", error);
      toast.error("Failed to create ticket. Please try again.");
    }
  });

  const filteredTickets = tickets.filter(ticket => {
    if (filters.status !== "all" && ticket.status !== filters.status) return false;
    if (filters.complexity !== "all" && ticket.complexity !== filters.complexity) return false;
    return true;
  });

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
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
              <Button 
                onClick={() => setShowCreate(true)} 
                size="lg"
                className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg border-0 font-bold"
              >
                <Plus className="h-5 w-5 mr-2" />
                New Ticket
              </Button>
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
                : "Create your first ticket to get help with issues, report bugs, or request new features."}
            </p>
            {filters.status === "all" && (
              <Button 
                onClick={() => setShowCreate(true)} 
                className="bg-blue-600 hover:bg-blue-700"
              >
                Create First Ticket
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTickets.map(ticket => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </div>

      <CreateTicketDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSubmit={createMutation.mutate}
        isSubmitting={createMutation.isPending}
      />
    </div>
  );
}

