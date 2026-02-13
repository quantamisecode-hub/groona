import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const SYSTEM_TEMPLATES = [
    {
        id: 'sys_standard',
        name: 'Standard Proposal',
        sections: [
            { title: 'Executive Summary', body: '<h2>Executive Summary</h2><p>Provide a brief overview of the proposal...</p>', section_type: 'SUMMARY' },
            { title: 'Problem Statement', body: '<h2>Problem Statement</h2><p>Describe the client\'s current challenges...</p>', section_type: 'PROBLEM' },
            { title: 'Proposed Solution', body: '<h2>Proposed Solution</h2><p>Detail your solution here...</p>', section_type: 'SOLUTION' },
            { title: 'Pricing', body: '<h2>Investment</h2><p>See pricing table below.</p>', section_type: 'PRICING' },
            { title: 'Next Steps', body: '<h2>Next Steps</h2><p>Outline the timeline and approval process...</p>', section_type: 'NEXT_STEPS' }
        ]
    },
    {
        id: 'sys_software',
        name: 'Software Development',
        sections: [
            { title: 'Project Overview', body: '<p>Overview of the software project...</p>', section_type: 'SUMMARY' },
            { title: 'Scope of Work', body: '<ul><li>Frontend Development</li><li>Backend API</li><li>QA Testing</li></ul>', section_type: 'SCOPE' },
            { title: 'Tech Stack', body: '<p>React, Node.js, PostgreSQL...</p>', section_type: 'TECH' },
            { title: 'Timeline', body: '<p>Phase 1: Discovery<br>Phase 2: Dev<br>Phase 3: Launch</p>', section_type: 'TIMELINE' }
        ]
    }
];

export default function CreateProposalDialog({ open, onOpenChange, clients = [] }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [title, setTitle] = useState("");
    const [clientId, setClientId] = useState("");
    const [templateId, setTemplateId] = useState("sys_standard");
    const [currency, setCurrency] = useState("USD");

    const { data: user } = useQuery({
        queryKey: ['me'],
        queryFn: () => groonabackend.auth.me(),
    });

    const { data: dbTemplates = [] } = useQuery({
        queryKey: ['templates'],
        queryFn: () => groonabackend.entities.ProposalTemplate.list(),
    });

    const allTemplates = [...SYSTEM_TEMPLATES, ...dbTemplates.map(t => ({
        id: t.id,
        name: t.name,
        sections: t.template_json?.sections || []
    }))];

    const createProposalMutation = useMutation({
        mutationFn: async () => {
            const template = allTemplates.find(t => t.id === templateId);
            
            // 1. Create Proposal
            if (!user?.tenant_id) throw new Error("User tenant ID not found");
            
            const proposal = await groonabackend.entities.Proposal.create({
                title,
                client_id: clientId,
                tenant_id: user.tenant_id,
                status: "draft",
                currency,
                total_amount: 0
            });

            // 2. Create Sections from Template
            if (template && template.sections) {
                const sectionPromises = template.sections.map((section, index) => 
                    groonabackend.entities.ProposalSection.create({
                        proposal_id: proposal.id,
                        tenant_id: proposal.tenant_id, // Backend handles this usually, but good to be explicit if needed
                        title: section.title,
                        body: section.body,
                        section_type: section.section_type,
                        sort_order: index
                    })
                );
                await Promise.all(sectionPromises);
            }

            return proposal;
        },
        onSuccess: (newProposal) => {
            toast.success("Proposal created successfully!");
            navigate(`${createPageUrl("ProposalEditor")}?id=${newProposal.id}`);
            onOpenChange(false);
            setTitle("");
            setClientId("");
        },
        onError: (err) => {
            toast.error("Failed to create proposal: " + err.message);
        }
    });

    const handleCreate = () => {
        if (!title || !clientId) {
            toast.error("Please fill in all required fields");
            return;
        }
        createProposalMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Proposal</DialogTitle>
                    <DialogDescription>Enter details to start a new proposal.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Proposal Title</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q4 Marketing Campaign" />
                    </div>
                    <div className="space-y-2">
                        <Label>Client</Label>
                        <Select value={clientId} onValueChange={setClientId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Client" />
                            </SelectTrigger>
                            <SelectContent>
                                {clients.map(client => (
                                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select value={currency} onValueChange={setCurrency}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Currency" />
                            </SelectTrigger>
                            <SelectContent>
                                {["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CNY", "INR"].map(c => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Template</Label>
                        <Select value={templateId} onValueChange={setTemplateId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Template" />
                            </SelectTrigger>
                            <SelectContent>
                                {allTemplates.map(t => (
                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={createProposalMutation.isPending}>
                        {createProposalMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Proposal
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

