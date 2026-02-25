import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Sparkles, TrendingUp, Loader2, ArrowRight, CheckSquare, Link as LinkIcon, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ReactMarkdown from "react-markdown";

const RETRO_TEMPLATES = {
  standard: {
    name: "Standard",
    columns: [
      { key: "what_went_well", label: "What Went Well", color: "bg-green-50 text-green-700 border-green-100" },
      { key: "what_could_be_improved", label: "Needs Improvement", color: "bg-red-50 text-red-700 border-red-100" }
    ]
  },
  start_stop_continue: {
    name: "Start, Stop, Continue",
    columns: [
      { key: "start", label: "Start Doing", color: "bg-blue-50 text-blue-700 border-blue-100" },
      { key: "stop", label: "Stop Doing", color: "bg-red-50 text-red-700 border-red-100" },
      { key: "continue", label: "Continue Doing", color: "bg-green-50 text-green-700 border-green-100" }
    ]
  },
  mad_sad_glad: {
    name: "Mad, Sad, Glad",
    columns: [
      { key: "mad", label: "Mad (Frustrations)", color: "bg-orange-50 text-orange-700 border-orange-100" },
      { key: "sad", label: "Sad (Disappointments)", color: "bg-blue-50 text-blue-700 border-blue-100" },
      { key: "glad", label: "Glad (Successes)", color: "bg-green-50 text-green-700 border-green-100" }
    ]
  }
};

export default function RetrospectiveView({ projectId, tenantId }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingRetro, setEditingRetro] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const queryClient = useQueryClient();
  
  const [newRetro, setNewRetro] = useState({
    title: "",
    meeting_date: format(new Date(), "yyyy-MM-dd"),
    template_type: "standard",
    inputs: {} 
  });
  
  const [analyzingTrends, setAnalyzingTrends] = useState(false);
  const [trendAnalysis, setTrendAnalysis] = useState(null);

  const { data: retrospectives = [] } = useQuery({
    queryKey: ['retrospectives', projectId],
    queryFn: () => groonabackend.entities.Retrospective.filter({ project_id: projectId }, '-meeting_date'),
    enabled: !!projectId
  });

  const createRetroMutation = useMutation({
    mutationFn: (data) => {
      // 1. Validation Check
      if (!tenantId) {
        throw new Error("Tenant ID is missing. Please try reloading the page.");
      }
      if (!projectId) {
        throw new Error("Project ID is missing.");
      }

      // 2. Robust Field Mapping for Legacy Fields
      const inputs = data.inputs || {};
      
      // Combine positive fields
      const positiveContent = [
        inputs.what_went_well,
        inputs.glad,
        inputs.continue,
        inputs.start // 'Start' is often considered positive/constructive
      ].filter(Boolean).join('\n\n');

      // Combine negative/constructive fields
      const negativeContent = [
        inputs.what_could_be_improved,
        inputs.stop,
        inputs.mad,
        inputs.sad
      ].filter(Boolean).join('\n\n');

      const payload = {
        project_id: projectId,
        tenant_id: tenantId,
        sprint_id: "none",
        title: data.title,
        meeting_date: data.meeting_date,
        template_type: data.template_type,
        // Map all inputs to feedback items array
        feedback_items: Object.entries(inputs).map(([category, content]) => ({
          category,
          content: content || "",
          votes: 0,
          author: 'anonymous'
        })),
        // Ensure legacy fields are at least empty strings, not undefined/null
        what_went_well: positiveContent || " ",
        what_could_be_improved: negativeContent || " "
      };
      
      console.log("Saving Retrospective Payload:", payload);
      return groonabackend.entities.Retrospective.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retrospectives'] });
      setShowCreate(false);
      setNewRetro({
        title: "",
        meeting_date: format(new Date(), "yyyy-MM-dd"),
        template_type: "standard",
        inputs: {}
      });
      toast.success("Retrospective created successfully");
    },
    onError: (error) => {
      console.error("Failed to create retrospective:", error);
      toast.error(`Failed to save: ${error.message}`);
    }
  });

  const updateRetroMutation = useMutation({
    mutationFn: ({ id, data }) => {
      const inputs = data.inputs || {};

      const positiveContent = [
        inputs.what_went_well,
        inputs.glad,
        inputs.continue,
        inputs.start
      ].filter(Boolean).join('\n\n');

      const negativeContent = [
        inputs.what_could_be_improved,
        inputs.stop,
        inputs.mad,
        inputs.sad
      ].filter(Boolean).join('\n\n');

      const payload = {
        title: data.title,
        meeting_date: data.meeting_date,
        template_type: data.template_type,
        feedback_items: Object.entries(inputs).map(([category, content]) => ({
          category,
          content: content || "",
          votes: 0,
          author: 'anonymous'
        })),
        what_went_well: positiveContent || " ",
        what_could_be_improved: negativeContent || " "
      };
      
      return groonabackend.entities.Retrospective.update(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retrospectives'] });
      setShowEdit(false);
      setEditingRetro(null);
      toast.success("Retrospective updated");
    },
    onError: (error) => {
      console.error("Update failed:", error);
      toast.error(`Failed to update: ${error.message}`);
    }
  });

  const deleteRetroMutation = useMutation({
    mutationFn: (id) => groonabackend.entities.Retrospective.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retrospectives'] });
      setDeleteConfirm(null);
      toast.success("Retrospective deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    }
  });

  const createTaskFromActionItemMutation = useMutation({
    mutationFn: async ({ retroId, actionItem, index }) => {
      if (!tenantId) throw new Error("Tenant ID missing");

      // 1. Create the task
      const newTask = await groonabackend.entities.Task.create({
        tenant_id: tenantId,
        project_id: projectId,
        title: `[Action Item] ${actionItem.description}`,
        description: `Generated from Retrospective: ${actionItem.description}`,
        status: 'todo',
        priority: 'medium',
        assigned_to: actionItem.assigned_to
      });

      // 2. Update the retrospective action item with the task ID
      const retro = retrospectives.find(r => r.id === retroId);
      if (!retro) throw new Error("Retrospective not found locally");
      
      const updatedActionItems = [...(retro.action_items || [])];
      updatedActionItems[index] = { ...actionItem, linked_task_id: newTask.id, status: 'in_progress' };
      
      await groonabackend.entities.Retrospective.update(retroId, {
        action_items: updatedActionItems
      });

      return newTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retrospectives'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] }); // Refresh tasks too
      toast.success("Task created from action item");
    },
    onError: (error) => {
      toast.error(`Failed to create task: ${error.message}`);
    }
  });

  const generateAISummary = useMutation({
    mutationFn: async (retro) => {
      // Prepare content based on feedback items
      let content = "";
      if (retro.feedback_items && retro.feedback_items.length > 0) {
        content = retro.feedback_items.map(f => `${f.category}: ${f.content}`).join('\n');
      } else {
        content = `Went Well: ${retro.what_went_well}\nTo Improve: ${retro.what_could_be_improved}`;
      }

      const response = await groonabackend.integrations.Core.InvokeLLM({
        prompt: `Generate a summary and concrete action items for this retrospective:
        ${content}`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            suggestions: { type: "string" },
            action_items: { 
              type: "array", 
              items: { 
                type: "object",
                properties: {
                  description: { type: "string" },
                  assigned_to: { type: "string", description: "Suggest a role or leave empty" }
                }
              }
            }
          }
        }
      });
      
      const result = typeof response === 'string' ? JSON.parse(response) : response;
      
      await groonabackend.entities.Retrospective.update(retro.id, {
        ai_summary: result.summary,
        ai_suggestions: result.suggestions,
        action_items: result.action_items?.map(ai => ({
          description: ai.description,
          assigned_to: ai.assigned_to || "",
          status: "open"
        })) || []
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retrospectives'] });
      toast.success("AI Analysis complete");
    },
    onError: (error) => {
      toast.error(`AI Analysis failed: ${error.message}`);
    }
  });

  const analyzeTrends = async () => {
    if (retrospectives.length < 2) {
      toast.info("Need at least 2 retrospectives to analyze trends.");
      return;
    }
    
    setAnalyzingTrends(true);
    try {
      const context = retrospectives.map(r => {
        const items = r.feedback_items?.map(f => `${f.category}: ${f.content}`).join('; ') 
          || `Went Well: ${r.what_went_well}; Improved: ${r.what_could_be_improved}`;
        return `Date: ${r.meeting_date}\n${items}`;
      }).join('\n---\n');

      const response = await groonabackend.integrations.Core.InvokeLLM({
        prompt: `Analyze the following retrospective records and identify recurring themes.
        1. Identify patterns in what goes well (Recurring Strengths).
        2. Identify persistent issues or blockers (Recurring Issues).
        3. Provide a high-level recommendation for the team.
        
        Data:
        ${context}`,
        response_json_schema: {
          type: "object",
          properties: {
            recurring_strengths: { type: "array", items: { type: "string" } },
            recurring_issues: { type: "array", items: { type: "string" } },
            recommendation: { type: "string" }
          }
        }
      });

      const result = typeof response === 'string' ? JSON.parse(response) : response;
      setTrendAnalysis(result);
      toast.success("Trend analysis complete");
    } catch (error) {
      console.error("Analysis failed:", error);
      toast.error("Failed to analyze trends");
    } finally {
      setAnalyzingTrends(false);
    }
  };

  const currentTemplate = RETRO_TEMPLATES[newRetro.template_type] || RETRO_TEMPLATES.standard;
  const editTemplate = editingRetro ? RETRO_TEMPLATES[editingRetro.template_type] || RETRO_TEMPLATES.standard : null;

  const handleEdit = (retro) => {
    const tpl = RETRO_TEMPLATES[retro.template_type] || RETRO_TEMPLATES.standard;
    const inputs = {};
    
    tpl.columns.forEach(col => {
      const item = retro.feedback_items?.find(f => f.category === col.key);
      if (item) {
        inputs[col.key] = item.content;
      } else {
        if (col.key === 'what_went_well') inputs[col.key] = retro.what_went_well || "";
        if (col.key === 'what_could_be_improved') inputs[col.key] = retro.what_could_be_improved || "";
      }
    });

    setEditingRetro({
      id: retro.id,
      title: retro.title,
      meeting_date: retro.meeting_date,
      template_type: retro.template_type,
      inputs
    });
    setShowEdit(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Retrospectives</h2>
        <div className="flex gap-2">
          {retrospectives.length >= 2 && (
            <Button 
              variant="outline" 
              onClick={analyzeTrends}
              disabled={analyzingTrends}
              className="text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              {analyzingTrends ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}
              Analyze Trends
            </Button>
          )}
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25">
              <Plus className="h-4 w-4 mr-2" /> New Retrospective
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Retrospective</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Title *</label>
                  <Input 
                    value={newRetro.title}
                    onChange={(e) => setNewRetro({...newRetro, title: e.target.value})}
                    placeholder="Sprint Retrospective"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Date</label>
                  <Input 
                    type="date"
                    value={newRetro.meeting_date}
                    onChange={(e) => setNewRetro({...newRetro, meeting_date: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid gap-2">
                <label className="text-sm font-medium">Template</label>
                <Select 
                  value={newRetro.template_type} 
                  onValueChange={(v) => setNewRetro({...newRetro, template_type: v, inputs: {}})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RETRO_TEMPLATES).map(([key, tpl]) => (
                      <SelectItem key={key} value={key}>{tpl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4">
                {currentTemplate.columns.map((col) => (
                  <div key={col.key} className="grid gap-2">
                    <label className={`text-sm font-medium px-2 py-1 rounded w-fit ${col.color}`}>
                      {col.label}
                    </label>
                    <Textarea 
                      value={newRetro.inputs[col.key] || ""}
                      onChange={(e) => setNewRetro({
                        ...newRetro, 
                        inputs: { ...newRetro.inputs, [col.key]: e.target.value }
                      })}
                      placeholder={`Record thoughts on ${col.label.toLowerCase()}...`}
                      rows={3}
                    />
                  </div>
                ))}
              </div>

              <Button 
                onClick={() => createRetroMutation.mutate(newRetro)}
                disabled={!newRetro.title || createRetroMutation.isPending}
                className="w-full"
              >
                {createRetroMutation.isPending ? (
                  <span className="flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                  </span>
                ) : (
                  "Save Retrospective"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {trendAnalysis && (
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-indigo-900">
              <TrendingUp className="h-5 w-5 mr-2" /> 
              Trend Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold text-indigo-700 mb-2">Recurring Strengths</h4>
                <ul className="list-disc list-inside text-sm text-indigo-900 space-y-1">
                  {trendAnalysis.recurring_strengths?.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-red-700 mb-2">Persistent Issues</h4>
                <ul className="list-disc list-inside text-sm text-red-900 space-y-1">
                  {trendAnalysis.recurring_issues?.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-blue-700 mb-2">Recommendation</h4>
                <p className="text-sm text-blue-900">{trendAnalysis.recommendation}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-4 text-xs text-slate-500 hover:text-slate-700"
              onClick={() => setTrendAnalysis(null)}
            >
              Dismiss Analysis
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6">
        {retrospectives.length === 0 ? (
           <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
             <p className="text-slate-500">No retrospectives recorded yet.</p>
           </div>
        ) : (
          retrospectives.map(retro => {
            const tpl = RETRO_TEMPLATES[retro.template_type] || RETRO_TEMPLATES.standard;
            
            // Helper to get content for a column
            const getContent = (key) => {
              const item = retro.feedback_items?.find(f => f.category === key);
              if (item) return item.content;
              // Fallback for legacy
              if (key === 'what_went_well') return retro.what_went_well;
              if (key === 'what_could_be_improved') return retro.what_could_be_improved;
              return "";
            };

            return (
              <Card key={retro.id} className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b bg-slate-50/50">
                  <div>
                    <CardTitle className="text-lg font-bold">{retro.title}</CardTitle>
                    <div className="text-sm text-muted-foreground flex items-center mt-1">
                      <Calendar className="mr-1 h-3 w-3" />
                      {retro.meeting_date && format(new Date(retro.meeting_date), 'PPP')}
                      <Badge variant="outline" className="ml-2 text-xs bg-white">
                        {tpl.name} Format
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!retro.ai_summary && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => generateAISummary.mutate(retro)}
                        disabled={generateAISummary.isPending}
                      >
                        <Sparkles className="h-3 w-3 mr-2" />
                        AI Analyze
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(retro)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDeleteConfirm(retro)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6 pt-6">
                  {/* Feedback Columns */}
                  <div className={`grid md:grid-cols-${tpl.columns.length} gap-4`}>
                    {tpl.columns.map(col => (
                      <div key={col.key} className={`p-4 rounded-lg border ${col.color} bg-opacity-20`}>
                        <h4 className="font-semibold mb-3 flex items-center uppercase text-xs tracking-wide">
                          {col.label}
                        </h4>
                        <div className="text-sm whitespace-pre-wrap leading-relaxed [&>p]:mb-2 last:[&>p]:mb-0">
                          {getContent(col.key) ? <ReactMarkdown>{getContent(col.key)}</ReactMarkdown> : <span className="text-slate-400 italic">No items recorded</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Summary Section */}
                  {(retro.ai_summary || retro.ai_suggestions) && (
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-100">
                      <h4 className="font-semibold text-purple-800 mb-3 flex items-center">
                        <Sparkles className="h-4 w-4 mr-2" /> AI Summary & Insights
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        {retro.ai_summary && (
                          <div>
                            <strong className="block text-purple-900 mb-1">Summary</strong>
                            <div className="text-purple-800 [&>p]:mb-2 last:[&>p]:mb-0">
                              <ReactMarkdown>{retro.ai_summary}</ReactMarkdown>
                            </div>
                          </div>
                          )}
                          {retro.ai_suggestions && (
                          <div>
                            <strong className="block text-purple-900 mb-1">Suggestions</strong>
                            <div className="text-purple-800 [&>p]:mb-2 last:[&>p]:mb-0">
                              <ReactMarkdown>{retro.ai_suggestions}</ReactMarkdown>
                            </div>
                          </div>
                          )}
                      </div>
                    </div>
                  )}

                  {/* Action Items Section */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 border-b flex justify-between items-center">
                      <h4 className="font-semibold text-sm text-slate-700 flex items-center">
                        <CheckSquare className="h-4 w-4 mr-2" /> Action Items
                      </h4>
                      <span className="text-xs text-slate-500">
                        {retro.action_items?.length || 0} items
                      </span>
                    </div>
                    <div className="divide-y">
                      {!retro.action_items?.length ? (
                        <div className="p-4 text-center text-sm text-slate-500 italic">
                          No action items generated yet.
                        </div>
                      ) : (
                        retro.action_items.map((item, idx) => (
                          <div key={idx} className="p-3 flex items-start justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className={`mt-1 h-2 w-2 rounded-full ${item.status === 'done' ? 'bg-green-500' : 'bg-blue-500'}`} />
                              <div>
                                <p className={`text-sm ${item.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                  {item.description}
                                </p>
                                {item.assigned_to && (
                                  <span className="text-xs text-slate-500 flex items-center mt-1">
                                    Assigned: {item.assigned_to}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {item.linked_task_id ? (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                                  <LinkIcon className="h-3 w-3" /> Linked Task
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                  onClick={() => createTaskFromActionItemMutation.mutate({
                                    retroId: retro.id,
                                    actionItem: item,
                                    index: idx
                                  })}
                                  disabled={createTaskFromActionItemMutation.isPending}
                                >
                                  <ArrowRight className="h-3 w-3 mr-1" /> Convert to Task
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Retrospective</DialogTitle>
          </DialogHeader>
          {editingRetro && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Title *</label>
                  <Input 
                    value={editingRetro.title}
                    onChange={(e) => setEditingRetro({...editingRetro, title: e.target.value})}
                    placeholder="Sprint Retrospective"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Date</label>
                  <Input 
                    type="date"
                    value={editingRetro.meeting_date}
                    onChange={(e) => setEditingRetro({...editingRetro, meeting_date: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid gap-2">
                <label className="text-sm font-medium">Template</label>
                <Select 
                  value={editingRetro.template_type} 
                  onValueChange={(v) => setEditingRetro({...editingRetro, template_type: v, inputs: {}})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RETRO_TEMPLATES).map(([key, tpl]) => (
                      <SelectItem key={key} value={key}>{tpl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4">
                {editTemplate && editTemplate.columns.map((col) => (
                  <div key={col.key} className="grid gap-2">
                    <label className={`text-sm font-medium px-2 py-1 rounded w-fit ${col.color}`}>
                      {col.label}
                    </label>
                    <Textarea 
                      value={editingRetro.inputs[col.key] || ""}
                      onChange={(e) => setEditingRetro({
                        ...editingRetro, 
                        inputs: { ...editingRetro.inputs, [col.key]: e.target.value }
                      })}
                      placeholder={`Record thoughts on ${col.label.toLowerCase()}...`}
                      rows={3}
                    />
                  </div>
                ))}
              </div>

              <Button 
                onClick={() => updateRetroMutation.mutate({ id: editingRetro.id, data: editingRetro })}
                disabled={!editingRetro.title || updateRetroMutation.isPending}
                className="w-full"
              >
                {updateRetroMutation.isPending ? (
                  <span className="flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...
                  </span>
                ) : (
                  "Update Retrospective"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Retrospective</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRetroMutation.mutate(deleteConfirm.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

