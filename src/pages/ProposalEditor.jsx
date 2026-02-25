import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, ArrowLeft, Bot, Sparkles, Plus, Trash2, GripVertical, CheckCircle2, MoreHorizontal, Download } from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import GenerateDraftDialog from "@/components/sales/GenerateDraftDialog";
import SectionEditor from "@/components/sales/SectionEditor";
import DebouncedInput from "@/components/sales/DebouncedInput";
import PricingItemDialog from "@/components/sales/PricingItemDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pencil } from "lucide-react";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CNY", "INR", "BRL", "CHF"];

export default function ProposalEditor() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const proposalId = urlParams.get('id');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("editor");
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [editingPricingItem, setEditingPricingItem] = useState(null);
  
  // Fetch Proposal
  const { data: proposal, isLoading: proposalLoading } = useQuery({
    queryKey: ['proposal', proposalId],
    queryFn: async () => {
        const p = await groonabackend.entities.Proposal.list();
        return p.find(x => x.id === proposalId);
    },
    enabled: !!proposalId
  });

  // Fetch Sections
  const { data: sections = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ['proposalSections', proposalId],
    queryFn: () => groonabackend.entities.ProposalSection.filter({ proposal_id: proposalId }),
    enabled: !!proposalId
  });

  // Fetch Pricing
  const { data: pricingItems = [], isLoading: pricingLoading } = useQuery({
    queryKey: ['proposalPricing', proposalId],
    queryFn: () => groonabackend.entities.ProposalPricingItem.filter({ proposal_id: proposalId }),
    enabled: !!proposalId
  });

  // Mutations
  const updateProposalMutation = useMutation({
    mutationFn: (data) => groonabackend.entities.Proposal.update(proposalId, data),
    onSuccess: () => {
        queryClient.invalidateQueries(['proposal', proposalId]);
        toast.success("Proposal updated");
    }
  });

  const deleteProposalMutation = useMutation({
    mutationFn: () => groonabackend.entities.Proposal.delete(proposalId),
    onSuccess: () => {
        toast.success("Proposal deleted");
        navigate(createPageUrl("SalesDashboard"));
    }
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ id, data }) => groonabackend.entities.ProposalSection.update(id, data),
    onSuccess: () => {
        queryClient.invalidateQueries(['proposalSections', proposalId]);
    }
  });

  const createSectionMutation = useMutation({
    mutationFn: (data) => groonabackend.entities.ProposalSection.create({ ...data, proposal_id: proposalId, tenant_id: proposal.tenant_id }),
    onSuccess: () => {
        queryClient.invalidateQueries(['proposalSections', proposalId]);
        toast.success("Section added");
    }
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id) => groonabackend.entities.ProposalSection.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['proposalSections', proposalId])
  });

  // Recalculate total when items change
  const updateProposalTotal = async (newItems) => {
    if (!proposal) return;
    const total = newItems.reduce((sum, item) => sum + (item.subtotal || (item.quantity * item.unit_price)), 0);
    await groonabackend.entities.Proposal.update(proposalId, { total_amount: total });
    queryClient.invalidateQueries(['proposal', proposalId]);
  };

  const createPricingItemMutation = useMutation({
    mutationFn: (data) => groonabackend.entities.ProposalPricingItem.create({ ...data, proposal_id: proposalId, tenant_id: proposal.tenant_id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries(['proposalPricing', proposalId]);
      const allItems = await groonabackend.entities.ProposalPricingItem.filter({ proposal_id: proposalId });
      updateProposalTotal(allItems);
      toast.success("Item added");
      setPricingDialogOpen(false);
    }
  });

  const updatePricingItemMutation = useMutation({
    mutationFn: ({ id, data }) => groonabackend.entities.ProposalPricingItem.update(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries(['proposalPricing', proposalId]);
      const allItems = await groonabackend.entities.ProposalPricingItem.filter({ proposal_id: proposalId });
      updateProposalTotal(allItems);
      toast.success("Item updated");
      setPricingDialogOpen(false);
    }
  });

  const deletePricingItemMutation = useMutation({
    mutationFn: (id) => groonabackend.entities.ProposalPricingItem.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries(['proposalPricing', proposalId]);
      const allItems = await groonabackend.entities.ProposalPricingItem.filter({ proposal_id: proposalId });
      updateProposalTotal(allItems);
      toast.success("Item deleted");
    }
  });

  const handleSavePricingItem = (data) => {
    if (editingPricingItem) {
        updatePricingItemMutation.mutate({ id: editingPricingItem.id, data });
    } else {
        createPricingItemMutation.mutate(data);
    }
  };

  const handleDraftGenerated = (data) => {
    // Update proposal title
    updateProposalMutation.mutate({ title: data.title });
    // Create sections
    if (data.sections) {
        // Optional: Clear existing sections? No, append for safety
        data.sections.forEach((s, idx) => {
            createSectionMutation.mutate({
                section_type: s.section_type,
                title: s.title,
                body: s.body,
                sort_order: idx
            });
        });
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    // Reordering logic simplified for this demo
    // In real app, would update sort_order of all affected items
  };

  const handleExportPDF = async () => {
    const toastId = toast.loading("Generating PDF...");
    try {
        const response = await groonabackend.functions.invoke('exportProposalPdf', { proposalId });
        const { pdfBase64, error } = response.data;
        
        if (error) throw new Error(error);

        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${pdfBase64}`;
        link.download = `${proposal.title || 'proposal'}.pdf`;
        link.click();
        
        toast.dismiss(toastId);
        toast.success("PDF downloaded!");
    } catch (err) {
        toast.dismiss(toastId);
        toast.error("Failed to export PDF: " + err.message);
    }
  };

  const handleSuggestPricing = () => {
    toast.promise(async () => {
        // Try to gather context from sections
        const contextText = sections.map(s => s.title + ": " + s.body).join("\n").substring(0, 1000);
        
        const response = await groonabackend.functions.invoke('suggestProposalPricing', {
            serviceType: "Consulting/Development", // Could be inferred
            scope: contextText,
            costHints: "Standard market rates"
        });

        const suggestions = response.data.items;
        if (suggestions && suggestions.length > 0) {
            // Add suggested items
            for (const item of suggestions) {
                await groonabackend.entities.ProposalPricingItem.create({
                    proposal_id: proposalId,
                    tenant_id: proposal.tenant_id,
                    item_name: item.item_name,
                    description: item.description,
                    quantity: item.quantity,
                    unit_type: item.unit_type,
                    unit_price: item.unit_price,
                    subtotal: item.quantity * item.unit_price
                });
            }
            await queryClient.invalidateQueries(['proposalPricing', proposalId]);
            const allItems = await groonabackend.entities.ProposalPricingItem.filter({ proposal_id: proposalId });
            updateProposalTotal(allItems);
            return `Added ${suggestions.length} suggested pricing items`;
        } else {
            throw new Error("No suggestions returned");
        }
    }, {
        loading: 'Analyzing proposal to suggest pricing...',
        success: (msg) => msg,
        error: 'Failed to suggest pricing'
    });
  };

  if (proposalLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!proposal) return <div className="p-8">Proposal not found</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(createPageUrl("SalesDashboard"))}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <div>
                <DebouncedInput 
                    value={proposal.title} 
                    onChange={(val) => updateProposalMutation.mutate({ title: val })} 
                    className="font-bold text-lg border-transparent hover:border-slate-200 focus:border-blue-500 w-96"
                />
                <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                    <Badge variant="outline">{proposal.status}</Badge>
                    
                    <Select 
                        value={proposal.currency || "USD"} 
                        onValueChange={(val) => updateProposalMutation.mutate({ currency: val })}
                    >
                        <SelectTrigger className="h-6 w-20 text-xs border-none bg-slate-100">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <span>{proposal.total_amount?.toLocaleString()}</span>
                </div>
            </div>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAiPanelOpen(!aiPanelOpen)}>
                <Sparkles className="h-4 w-4 mr-2 text-purple-600" />
                AI Assistant
            </Button>
            <Button variant="outline" onClick={handleExportPDF}>
                <Download className="h-4 w-4 mr-2" /> Export PDF
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => toast.success("All changes are saved automatically")}>
                <Save className="h-4 w-4 mr-2" /> Save
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-red-600" onClick={() => deleteProposalMutation.mutate()}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete Proposal
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Section Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 overflow-y-auto p-4 hidden md:block">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-700">Sections</h3>
                <Button size="icon" variant="ghost" onClick={() => createSectionMutation.mutate({ title: "New Section", body: "", section_type: "CUSTOM" })}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
            
            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="sections-list">
                    {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                            {sections.sort((a,b) => a.sort_order - b.sort_order).map((section, index) => (
                                <Draggable key={section.id} draggableId={section.id} index={index}>
                                    {(provided) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            className="bg-slate-50 p-3 rounded border border-slate-200 flex items-center gap-2 group hover:border-blue-300 cursor-pointer"
                                            onClick={() => document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: 'smooth' })}
                                        >
                                            <GripVertical className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm truncate flex-1">{section.title}</span>
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
            
            {sections.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                    No sections yet.
                    <Button variant="link" onClick={() => setGenerateOpen(true)} className="text-purple-600">Generate with AI</Button>
                </div>
            )}
        </aside>

        {/* Main Editor Area */}
        <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-6">
                    <TabsTrigger value="editor">Proposal Content</TabsTrigger>
                    <TabsTrigger value="pricing">Pricing</TabsTrigger>
                </TabsList>
                
                <TabsContent value="editor" className="space-y-8">
                    {sections.sort((a,b) => a.sort_order - b.sort_order).map((section) => (
                        <Card key={section.id} id={`section-${section.id}`} className="group">
                            <CardHeader className="flex flex-row items-center justify-between py-3 bg-slate-50 border-b border-slate-100">
                                <DebouncedInput 
                                    value={section.title} 
                                    onChange={(val) => updateSectionMutation.mutate({ id: section.id, data: { title: val } })}
                                    className="font-bold text-lg bg-transparent border-none shadow-none focus-visible:ring-0 w-1/2" 
                                />
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <Button size="sm" variant="ghost" className="text-purple-600" onClick={() => {
                                        toast.promise(groonabackend.functions.invoke('rewriteProposalSection', {
                                            currentBody: section.body,
                                            context: { type: section.section_type },
                                            instruction: "Make it more professional"
                                        }), {
                                            loading: 'Rewriting...',
                                            success: (r) => {
                                                updateSectionMutation.mutate({ id: section.id, data: { body: r.data.rewrittenBody } });
                                                return "Rewritten!";
                                            },
                                            error: "Failed"
                                        });
                                    }}>
                                        <Sparkles className="h-3 w-3 mr-1" /> Enhance
                                    </Button>
                                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteSectionMutation.mutate(section.id)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4">
                                <SectionEditor 
                                    value={section.body || ''} 
                                    onChange={(val) => updateSectionMutation.mutate({ id: section.id, data: { body: val } })}
                                    className="min-h-[200px] bg-white"
                                    modules={{
                                        toolbar: [
                                            [{ 'header': [1, 2, 3, false] }],
                                            ['bold', 'italic', 'underline', 'strike'],
                                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                            ['clean']
                                        ]
                                    }}
                                />
                            </CardContent>
                        </Card>
                    ))}
                    
                     <Button variant="outline" className="w-full border-dashed py-8" onClick={() => createSectionMutation.mutate({ title: "New Section", body: "", section_type: "CUSTOM" })}>
                        <Plus className="h-4 w-4 mr-2" /> Add Section
                    </Button>
                </TabsContent>
                
                <TabsContent value="pricing">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <CardTitle>Pricing Breakdown</CardTitle>
                            <div className="text-xl font-bold text-blue-600">
                                Total: {proposal.currency} {proposal.total_amount?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {pricingItems.length === 0 && (
                                    <div className="text-center py-8 text-slate-400 bg-slate-50 rounded border border-dashed">
                                        No items yet. Add a line item to start building the quote.
                                    </div>
                                )}
                                {pricingItems.map((item) => (
                                    <div key={item.id} className="grid grid-cols-12 gap-4 items-center p-3 border rounded bg-white hover:border-blue-200 transition-colors shadow-sm">
                                        <div className="col-span-5">
                                            <div className="font-medium">{item.item_name}</div>
                                            {item.description && <div className="text-xs text-slate-500 truncate">{item.description}</div>}
                                        </div>
                                        <div className="col-span-2 text-right text-sm">
                                            <span className="font-medium">{item.quantity}</span> <span className="text-slate-500">{item.unit_type}</span>
                                        </div>
                                        <div className="col-span-2 text-right text-sm">
                                            <span className="text-slate-500">@</span> {item.unit_price.toFixed(2)}
                                        </div>
                                        <div className="col-span-2 text-right font-bold text-slate-900">
                                            {(item.quantity * item.unit_price).toFixed(2)}
                                        </div>
                                        <div className="col-span-1 text-right flex justify-end gap-1">
                                             <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                className="h-8 w-8 text-slate-500 hover:text-blue-600"
                                                onClick={() => {
                                                    setEditingPricingItem(item);
                                                    setPricingDialogOpen(true);
                                                }}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                             <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                className="h-8 w-8 text-slate-500 hover:text-red-600"
                                                onClick={() => {
                                                    if(confirm("Delete this item?")) deletePricingItemMutation.mutate(item.id);
                                                }}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                <Button 
                                    className="w-full border-dashed py-6 text-slate-600 hover:text-blue-600 hover:bg-blue-50" 
                                    variant="outline"
                                    onClick={() => {
                                        setEditingPricingItem(null);
                                        setPricingDialogOpen(true);
                                    }}
                                >
                                    <Plus className="h-4 w-4 mr-2" /> Add Line Item
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>

        <PricingItemDialog
            open={pricingDialogOpen}
            onOpenChange={setPricingDialogOpen}
            item={editingPricingItem}
            onSave={handleSavePricingItem}
            isLoading={createPricingItemMutation.isPending || updatePricingItemMutation.isPending}
        />

        {/* AI Sidebar */}
        {aiPanelOpen && (
            <aside className="w-80 bg-white border-l border-slate-200 p-4 shadow-lg overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Bot className="h-4 w-4 text-purple-600" /> AI Assistant
                    </h3>
                    <Button size="icon" variant="ghost" onClick={() => setAiPanelOpen(false)}>X</Button>
                </div>
                
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Quality Check</CardTitle></CardHeader>
                        <CardContent>
                            <Button size="sm" className="w-full bg-purple-100 text-purple-700 hover:bg-purple-200" onClick={() => {
                                toast.promise(groonabackend.functions.invoke('checkProposalQuality', {
                                    proposalContent: sections,
                                    pricingItems
                                }), {
                                    loading: 'Checking quality...',
                                    success: (r) => {
                                        // Show issues in a dialog or list
                                        return `Found ${r.data.issues?.length || 0} potential improvements`;
                                    },
                                    error: 'Failed check'
                                });
                            }}>Run Quality Check</Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => setGenerateOpen(true)}>
                                <Sparkles className="h-3 w-3 mr-2 text-purple-500" /> Generate Draft
                            </Button>
                            <Button size="sm" variant="outline" className="w-full justify-start" onClick={handleSuggestPricing}>
                                <Bot className="h-3 w-3 mr-2 text-blue-500" /> Suggest Pricing
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </aside>
        )}
      </main>
      
      <GenerateDraftDialog 
        open={generateOpen} 
        onOpenChange={setGenerateOpen} 
        onDraftGenerated={handleDraftGenerated}
        proposalTitle={proposal.title}
      />
    </div>
  );
}

