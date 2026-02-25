import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Sparkles, Loader2, Download } from "lucide-react";
import ReactMarkdown from 'react-markdown';

export default function ProjectProposal({ currentUser }) {
  const [requirements, setRequirements] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [proposal, setProposal] = useState(null);

  const generateProposal = async () => {
    if (!requirements.trim()) return;

    setIsGenerating(true);
    setProposal(null);

    try {
      const prompt = `You are an expert project manager. Generate a comprehensive project proposal based on the following requirements:

REQUIREMENTS:
${requirements}

Generate a detailed project proposal with the following sections:

1. **Executive Summary**
   - Brief overview of the project
   - Key objectives

2. **Project Scope**
   - Detailed description of what will be delivered
   - What's included and excluded
   
3. **Deliverables**
   - List of specific deliverables
   - Acceptance criteria for each

4. **Timeline & Milestones**
   - Proposed project phases
   - Key milestones with estimated durations
   - Total estimated timeline

5. **Resource Requirements**
   - Team composition needed
   - Skills required
   - Tools and technologies

6. **Risk Assessment**
   - Potential risks
   - Mitigation strategies

7. **Budget Estimate**
   - High-level cost breakdown
   - Resource allocation

8. **Success Criteria**
   - How success will be measured
   - Key performance indicators

Format the proposal professionally with clear sections and bullet points. Be specific and actionable.`;

      const result = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false,
      });

      setProposal(result);
    } catch (error) {
      console.error('Error generating proposal:', error);
      setProposal("Error generating proposal. Please try again.");
    }

    setIsGenerating(false);
  };

  const downloadProposal = () => {
    if (!proposal) return;

    const blob = new Blob([proposal], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project-proposal-${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-600" />
            AI Project Proposal Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700">
              Enter Project Requirements
            </label>
            <Textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Describe your project requirements, goals, and constraints. Be as detailed as possible...

Example:
- Build a mobile app for task management
- Target audience: small business teams
- Must integrate with Google Calendar
- Budget: $50,000
- Timeline: 3 months"
              rows={10}
              className="bg-white border-slate-200"
              disabled={isGenerating}
            />
          </div>

          <Button
            onClick={generateProposal}
            disabled={!requirements.trim() || isGenerating}
            className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Proposal...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Proposal
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {proposal && (
        <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-600" />
                Generated Project Proposal
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadProposal}
                className="border-violet-200"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none bg-white p-6 rounded-lg">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-2xl font-bold text-slate-900 mt-6 mb-4">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xl font-semibold text-slate-900 mt-5 mb-3">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-semibold text-slate-900 mt-4 mb-2">{children}</h3>,
                  p: ({ children }) => <p className="text-slate-700 mb-3 leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside text-slate-700 space-y-2 mb-4">{children}</ol>,
                  li: ({ children }) => <li className="text-slate-700">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-violet-300 pl-4 italic text-slate-600 my-4">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {proposal}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

