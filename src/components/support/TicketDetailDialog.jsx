import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Loader2, 
  Send, 
  User, 
  Calendar, 
  Globe, 
  Monitor,
  ExternalLink,
  MessageSquare,
  CheckCircle2
} from "lucide-react";
import { groonabackend } from "@/api/groonabackend";
import { toast } from "sonner";
import { format } from "date-fns";

export default function TicketDetailDialog({ open, onClose, ticket, onUpdate, currentUser }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [localTicket, setLocalTicket] = useState(ticket);

  const isSupportOrAdmin = currentUser?.role === 'support' || currentUser?.role === 'admin' || currentUser?.is_super_admin;

  useEffect(() => {
    if (ticket && open) {
      setLocalTicket(ticket);
      loadComments();
    }
  }, [ticket, open]);

  const loadComments = async () => {
    try {
      const fetchedComments = await groonabackend.entities.TicketComment.filter(
        { ticket_id: ticket.id },
        '-created_date'
      );
      setComments(fetchedComments);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await groonabackend.entities.TicketComment.create({
        tenant_id: ticket.tenant_id,
        ticket_id: ticket.id,
        author_email: currentUser.email,
        author_name: currentUser.full_name,
        author_role: currentUser.role,
        content: newComment,
        is_internal: isInternal,
      });

      await groonabackend.entities.Ticket.update(ticket.id, {
        last_activity_at: new Date().toISOString(),
        first_response_at: ticket.first_response_at || new Date().toISOString(),
      });

      setNewComment("");
      setIsInternal(false);
      await loadComments();
      toast.success('Comment added');
    } catch (error) {
      console.error('Failed to add comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTicket = async (field, value) => {
    setUpdating(true);
    try {
      const updates = { [field]: value };
      
      if (field === 'status' && value === 'resolved') {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = currentUser.email;
        
        const createdDate = new Date(ticket.created_date);
        const resolvedDate = new Date();
        updates.resolution_time_minutes = Math.floor((resolvedDate - createdDate) / (1000 * 60));
      }
      
      if (field === 'assigned_to_email' && value) {
        const users = await groonabackend.entities.User.list();
        const assignedUser = users.find(u => u.email === value);
        if (assignedUser) {
          updates.assigned_to_name = assignedUser.full_name;
        }
      }

      await groonabackend.entities.Ticket.update(ticket.id, updates);
      
      setLocalTicket({ ...localTicket, ...updates });
      if (onUpdate) onUpdate();
      
      toast.success('Ticket updated');
    } catch (error) {
      console.error('Failed to update ticket:', error);
      toast.error('Failed to update ticket');
    } finally {
      setUpdating(false);
    }
  };

  const priorityColors = {
    low: "bg-blue-100 text-blue-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    critical: "bg-red-100 text-red-800",
  };

  const statusColors = {
    open: "bg-blue-100 text-blue-800",
    in_progress: "bg-purple-100 text-purple-800",
    waiting_response: "bg-yellow-100 text-yellow-800",
    resolved: "bg-green-100 text-green-800",
    closed: "bg-slate-100 text-slate-800",
    reopened: "bg-orange-100 text-orange-800",
  };

  if (!localTicket) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-sm font-mono text-slate-500">{localTicket.ticket_number}</span>
            <span>{localTicket.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status & Priority Controls - Support Only */}
          {isSupportOrAdmin && (
            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={localTicket.status}
                  onValueChange={(value) => handleUpdateTicket('status', value)}
                  disabled={updating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="waiting_response">Waiting Response</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="reopened">Reopened</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={localTicket.priority}
                  onValueChange={(value) => handleUpdateTicket('priority', value)}
                  disabled={updating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select
                  value={localTicket.assigned_to_email || ""}
                  onValueChange={(value) => handleUpdateTicket('assigned_to_email', value)}
                  disabled={updating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Unassigned</SelectItem>
                    <SelectItem value={currentUser.email}>Me</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Ticket Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className={statusColors[localTicket.status]}>
                {localTicket.status.replace('_', ' ')}
              </Badge>
              <Badge className={priorityColors[localTicket.priority]}>
                {localTicket.priority}
              </Badge>
              <Badge variant="outline">{localTicket.type.replace('_', ' ')}</Badge>
              {localTicket.category && (
                <Badge variant="outline">{localTicket.category.replace('_', ' ')}</Badge>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-sm text-slate-700 mb-2">Description</h4>
              <p className="text-slate-600 whitespace-pre-wrap">{localTicket.description}</p>
            </div>

            {localTicket.screenshots?.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-slate-700 mb-2">Screenshots</h4>
                <div className="flex flex-wrap gap-2">
                  {localTicket.screenshots.map((url, index) => (
                    <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={`Screenshot ${index + 1}`}
                        className="h-24 w-24 object-cover rounded-lg border-2 border-slate-200 hover:border-blue-500 transition-colors"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <User className="h-4 w-4" />
                <span>Reported by: <strong>{localTicket.reporter_name}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(localTicket.created_date), 'MMM d, yyyy HH:mm')}</span>
              </div>
              {localTicket.page_url && (
                <div className="flex items-center gap-2 text-slate-600 col-span-2">
                  <Globe className="h-4 w-4" />
                  <a href={localTicket.page_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                    {localTicket.page_url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {localTicket.browser_info && (
                <div className="flex items-center gap-2 text-slate-600 col-span-2 text-xs">
                  <Monitor className="h-4 w-4" />
                  <span>{localTicket.browser_info}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Comments Section */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comments ({comments.length})
            </h4>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`p-3 rounded-lg ${
                    comment.is_internal ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                        {comment.author_name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{comment.author_name}</span>
                        <Badge variant="outline" className="text-xs">{comment.author_role}</Badge>
                        {comment.is_internal && (
                          <Badge className="bg-amber-100 text-amber-800 text-xs">Internal</Badge>
                        )}
                        <span className="text-xs text-slate-500">
                          {format(new Date(comment.created_date), 'MMM d, HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Comment */}
            <div className="space-y-3 border-t pt-4">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
              />
              
              {isSupportOrAdmin && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="internal"
                    checked={isInternal}
                    onCheckedChange={setIsInternal}
                  />
                  <Label htmlFor="internal" className="text-sm cursor-pointer">
                    Internal note (visible only to support team)
                  </Label>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleAddComment}
                  disabled={submitting || !newComment.trim()}
                  className="bg-gradient-to-r from-blue-500 to-purple-600"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Post Comment
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

