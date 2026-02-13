import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Send, Clock, User, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/components/shared/UserContext";
import { toast } from "sonner";

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const tickets = await groonabackend.entities.Ticket.filter({ _id: id });
      return tickets[0];
    },
    enabled: !!id
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["ticket-comments", id],
    queryFn: () => groonabackend.entities.TicketComment.filter({ ticket_id: id }, "created_at"),
    enabled: !!id
  });

  const commentMutation = useMutation({
    mutationFn: async (text) => {
      return groonabackend.entities.TicketComment.create({
        ticket_id: id,
        user_id: user.id,
        user_name: user.full_name,
        user_role: user.role,
        message: text,
        created_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["ticket-comments", id]);
      setCommentText("");
      toast.success("Reply posted");
    }
  });

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600"/></div>;
  if (!ticket) return <div className="p-8 text-center">Ticket not found</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link to="/support/tickets" className="inline-flex items-center text-slate-500 hover:text-blue-600 mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Tickets
        </Link>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">{ticket.title}</h1>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>Reported by {ticket.reporter_name}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(ticket.created_date || Date.now()), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                    {ticket.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  {ticket.description}
                </div>
              </CardContent>
            </Card>

            {/* Conversation */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Discussion History</h3>
              {comments.map((comment) => (
                <Card key={comment.id} className={`${comment.user_id === user.id ? "border-blue-200 bg-blue-50/30" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                          {comment.user_name?.charAt(0) || "U"}
                        </div>
                        <span className="font-medium text-sm">{comment.user_name}</span>
                        {comment.user_role === 'admin' && <Badge variant="outline" className="text-[10px] h-5">Support</Badge>}
                      </div>
                      <span className="text-xs text-slate-400">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 pl-10">{comment.message}</p>
                  </CardContent>
                </Card>
              ))}

              <div className="mt-6">
                <Textarea 
                  placeholder="Type your reply here..." 
                  className="mb-3"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <Button 
                  onClick={() => commentMutation.mutate(commentText)} 
                  disabled={!commentText.trim() || commentMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Post Reply
                </Button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Ticket Info</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <label className="text-slate-500 text-xs block mb-1">Ticket ID</label>
                  <span className="font-mono bg-slate-100 px-2 py-1 rounded">{ticket.ticket_number || ticket.id.substring(0, 8)}</span>
                </div>
                <div>
                  <label className="text-slate-500 text-xs block mb-1">Priority</label>
                  <Badge variant="outline">{ticket.priority}</Badge>
                </div>
                {ticket.sla_deadline && (
                  <div>
                    <label className="text-slate-500 text-xs block mb-1">SLA Deadline</label>
                    <div className="flex items-center gap-2 text-orange-600 font-medium">
                      <Clock className="h-4 w-4" />
                      {new Date(ticket.sla_deadline).toLocaleDateString()}
                    </div>
                  </div>
                )}
                <Separator />
                <div>
                  <label className="text-slate-500 text-xs block mb-1">Assigned Agent</label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <span>{ticket.assigned_to_name || "Unassigned"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

