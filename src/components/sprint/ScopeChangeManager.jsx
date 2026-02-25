import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { History, MessageSquarePlus, Loader2, Link as LinkIcon, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "../shared/UserContext";

export default function ScopeChangeManager({ sprint, projectId, tenantId }) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState({ title: "", description: "", related_task_id: "none" });

  // 1. Fetch "Change Requests" (Tasks tagged as 'Scope Change')
  const { data: changeRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['scope-change-requests', sprint.id],
    queryFn: async () => {
      const tasks = await groonabackend.entities.Task.filter({
        sprint_id: sprint.id,
        project_id: projectId
      });
      return tasks.filter(t => t.labels && t.labels.includes('Scope Change'));
    }
  });

  // 2. Fetch all tasks in sprint for the "Related Task" dropdown
  const { data: sprintTasks = [] } = useQuery({
    queryKey: ['sprint-tasks-list', sprint.id],
    queryFn: () => groonabackend.entities.Task.filter({ sprint_id: sprint.id })
  });

  // 3. Fetch System Audit Logs
  const { data: systemLogs = [] } = useQuery({
    queryKey: ['sprint-audit-logs', sprint.id],
    queryFn: () => groonabackend.entities.AuditLog.filter({
      entity_id: sprint.id,
      entity_type: 'Sprint'
    })
  });

  // Mutation to create a Change Request
  const createRequestMutation = useMutation({
    mutationFn: async (data) => {
      let description = data.description;
      
      // Append related task info to description if selected
      if (data.related_task_id && data.related_task_id !== "none") {
          const relatedTask = sprintTasks.find(t => t.id === data.related_task_id);
          if (relatedTask) {
              description = `[Ref Task: ${relatedTask.title}]\n\n${description}`;
          }
      }

      return await groonabackend.entities.Task.create({
        tenant_id: tenantId,
        project_id: projectId,
        sprint_id: sprint.id,
        title: `Change Request: ${data.title}`,
        description: description,
        task_type: 'story', 
        status: 'todo', // Starts in Todo -> Team moves to In Progress -> Done
        priority: 'high',
        labels: ['Scope Change', 'Client Request'],
        reporter: user?.email,
        assigned_to: [] 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scope-change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['client-tasks'] }); 
      toast.success("Scope change request submitted successfully");
      setShowRequestDialog(false);
      setRequestForm({ title: "", description: "", related_task_id: "none" });
    },
    onError: (err) => {
      toast.error("Failed to submit request: " + err.message);
    }
  });

  const handleSubmit = () => {
    if (!requestForm.title || !requestForm.description) {
      toast.error("Please fill in the title and comments");
      return;
    }
    createRequestMutation.mutate(requestForm);
  };

  const getStatusBadge = (status) => {
    const styles = {
      todo: "bg-slate-100 text-slate-700 border-slate-200",
      in_progress: "bg-blue-100 text-blue-700 border-blue-200",
      completed: "bg-green-100 text-green-700 border-green-200",
      review: "bg-amber-100 text-amber-700 border-amber-200"
    };
    const label = status === 'todo' ? 'Received' : status === 'in_progress' ? 'Working On It' : status === 'completed' ? 'Implemented' : status;
    
    return (
      <Badge variant="outline" className={`${styles[status] || styles.todo} capitalize`}>
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Request Section */}
      <Card className="border-blue-100 bg-blue-50/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-blue-900">Scope Change Requests</CardTitle>
              <p className="text-sm text-blue-700 mt-1">
                Request changes to specific tasks or general sprint scope. Track status here.
              </p>
            </div>
            <Button onClick={() => setShowRequestDialog(true)} className="bg-blue-600 hover:bg-blue-700">
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              Request Change
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-white overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Change Request</TableHead>
                  <TableHead>Comments / Details</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Current Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requestsLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-4">Loading...</TableCell></TableRow>
                ) : changeRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-500 italic">
                      No active change requests. Use the button above to ask for changes.
                    </TableCell>
                  </TableRow>
                ) : (
                  changeRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.title.replace('Change Request: ', '')}</TableCell>
                      <TableCell className="text-slate-600 max-w-md">
                        <div className="line-clamp-2" title={req.description}>{req.description}</div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{req.reporter}</TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 2. System Audit Logs Section */}
      <div className="pt-4">
        <div className="flex items-center gap-2 mb-4">
          <History className="h-5 w-5 text-slate-500" />
          <h3 className="font-semibold text-slate-800">System Change History</h3>
        </div>
        
        <div className="rounded-md border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {systemLogs.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={4} className="text-center py-6 text-slate-500">
                     No system logs recorded yet.
                   </TableCell>
                 </TableRow>
              ) : (
                systemLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <Badge variant="outline" className="capitalize bg-slate-50">
                        {log.action || 'Update'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{log.details}</TableCell>
                    <TableCell className="text-sm">{log.user_name || 'System'}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {format(new Date(log.created_at), 'MMM d, h:mm a')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Request Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Request Scope Change</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            
            {/* Related Task Dropdown */}
            <div className="space-y-2">
                <Label>Related Task (Optional)</Label>
                <Select 
                    value={requestForm.related_task_id} 
                    onValueChange={(val) => setRequestForm({...requestForm, related_task_id: val})}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select a task to modify..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">-- General Change / No Specific Task --</SelectItem>
                        {sprintTasks.map(task => (
                            <SelectItem key={task.id} value={task.id}>
                                {task.title.substring(0, 40)}{task.title.length > 40 ? '...' : ''}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500">Select a task if you want to request changes to a specific item.</p>
            </div>

            <div className="space-y-2">
              <Label>Request Title</Label>
              <Input 
                placeholder="e.g. Change Button Color, Add New Field..." 
                value={requestForm.title}
                onChange={(e) => setRequestForm({...requestForm, title: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Comments / Change Details</Label>
              <Textarea 
                placeholder="Please describe exactly what needs to be changed..." 
                rows={4}
                value={requestForm.description}
                onChange={(e) => setRequestForm({...requestForm, description: e.target.value})}
              />
            </div>

            <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-md flex gap-2 items-start">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Submitting this request will alert the development team. 
                They will update the status (Received -> Working On It -> Implemented) which you can track in the table above.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createRequestMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createRequestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

