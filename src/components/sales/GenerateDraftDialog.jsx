import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function GenerateDraftDialog({ open, onOpenChange, onDraftGenerated, proposalTitle }) {
    const [clientName, setClientName] = useState("");
    const [industry, setIndustry] = useState("");
    const [description, setDescription] = useState("");
    const [services, setServices] = useState("");
    const [timeline, setTimeline] = useState("");

    const generateMutation = useMutation({
        mutationFn: async () => {
            const response = await groonabackend.functions.invoke('generateProposalDraft', {
                clientName: clientName || "Generic Client",
                clientIndustry: industry || "General",
                projectDescription: description || proposalTitle,
                servicesOffered: services.split(',').map(s => s.trim()),
                budgetRange: "Standard",
                timelineHint: timeline
            });
            return response.data;
        },
        onSuccess: (data) => {
            onDraftGenerated(data);
            onOpenChange(false);
            toast.success("Draft generated successfully!");
        },
        onError: (err) => {
            toast.error("AI Generation failed: " + err.message);
        }
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        AI Proposal Drafter
                    </DialogTitle>
                    <DialogDescription>
                        Provide details to generate a tailored proposal structure and content.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Client Name</Label>
                            <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Acme Corp" />
                        </div>
                        <div className="space-y-2">
                            <Label>Industry</Label>
                            <Input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="SaaS, Healthcare..." />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Project Description</Label>
                        <Textarea 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            placeholder="Describe the project goals and scope..."
                            className="h-24"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Services (comma separated)</Label>
                        <Input value={services} onChange={e => setServices(e.target.value)} placeholder="Web Dev, SEO, Consulting..." />
                    </div>
                    <div className="space-y-2">
                        <Label>Estimated Timeline</Label>
                        <Input value={timeline} onChange={e => setTimeline(e.target.value)} placeholder="e.g. 3 months" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button 
                        onClick={() => generateMutation.mutate()} 
                        disabled={generateMutation.isPending}
                        className="bg-purple-600 hover:bg-purple-700"
                    >
                        {generateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Generate Draft
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

