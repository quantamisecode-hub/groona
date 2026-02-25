import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Save, Loader2, FileText, Download } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { toast } from "sonner";
import { useUser } from "@/components/shared/UserContext";

export default function DocumentEditor({ document, onSave, onCancel, projects = [] }) {
  const { effectiveTenantId } = useUser();
  const [title, setTitle] = useState(document?.title || "");
  const [content, setContent] = useState(document?.content || "");
  const [category, setCategory] = useState(document?.category || "general");
  const [projectId, setProjectId] = useState(document?.project_id || "");
  const [tags, setTags] = useState(document?.tags?.join(", ") || "");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Filter projects to only show those from the user's tenant organization
  const filteredProjects = projects.filter(project => {
    if (!effectiveTenantId) return false;
    const projectTenantId = project.tenant_id || project._tenant_id;
    return projectTenantId === effectiveTenantId;
  });

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ color: [] }, { background: [] }],
      ["link", "code-block"],
      ["clean"],
    ],
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a prompt for AI generation");
      return;
    }

    setIsGenerating(true);
    try {
      // --- UPDATED PROMPT: Force Semantic HTML Structure ---
      const response = await groonabackend.integrations.Core.InvokeLLM({
        prompt: `Create a comprehensive, professional document based on this request: "${aiPrompt}".
        
        STRICT FORMATTING RULES:
        1. Output ONLY valid HTML. Do NOT use markdown (no \`\`\` or **).
        2. Structure the document clearly:
           - Use <h2> for main section headers (e.g., "Introduction", "Strategy").
           - Use <h3> for subsections.
           - Use <p> for body text. Ensure paragraphs are detailed.
        3. LISTS & INDENTATION:
           - Use <ul> with <li> for bullet points.
           - Use <ol> with <li> for numbered steps.
           - NEVER use manual hyphens (-) or numbers (1.) for lists; use the proper HTML tags.
        4. HIGHLIGHTING:
           - Use <strong> to highlight key terms or metrics.
           - Use <em> for emphasis.
        
        Example structure to follow:
        <h2>1. Executive Summary</h2>
        <p>Overview text here...</p>
        <h3>Key Objectives</h3>
        <ul>
          <li><strong>Objective 1:</strong> Description...</li>
        </ul>
        `,
      });

      // --- CLEANUP: Strip markdown code blocks if AI ignores instructions ---
      let cleanContent = response || "";
      
      // Remove ```html ... ``` wrappers
      cleanContent = cleanContent.replace(/^```html\s*/i, "").replace(/^```\s*/i, "");
      cleanContent = cleanContent.replace(/\s*```$/i, "");

      setContent(cleanContent.trim());
      toast.success("Document generated successfully!");
      setAiPrompt("");
    } catch (error) {
      toast.error("Failed to generate document: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Please enter a document title");
      return;
    }

    if (!content.trim()) {
      toast.error("Please add some content to the document");
      return;
    }

    if (!projectId) {
      toast.error("Please select a project");
      return;
    }

    setIsSaving(true);
    try {
      const tagArray = tags.split(",").map(t => t.trim()).filter(Boolean);
      
      await onSave({
        title: title.trim(),
        content,
        category,
        project_id: projectId,
        tags: tagArray,
        ai_generated: false,
      });
      
      toast.success(document ? "Document updated!" : "Document created!");
    } catch (error) {
      console.error("Save document error:", error);
      toast.error("Failed to save document: " + (error.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPdf = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Document must have a title and content to export");
      return;
    }

    setIsExporting(true);
    try {
      const currentUser = await groonabackend.auth.me();
      const response = await groonabackend.functions.invoke('generateDocumentPdf', {
        title: title.trim(),
        content: content,
        author: currentUser?.full_name || "",
        created_date: document?.created_date || new Date().toISOString()
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      window.document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      link.remove();

      toast.success("Document exported as PDF!");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF: " + (error.message || "Unknown error"));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Generation Section */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Document Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Describe what you want to create</Label>
            <Input
              placeholder="e.g., 'Project requirements document for a mobile app' or 'Meeting notes template'"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAIGenerate()}
            />
          </div>
          <Button
            onClick={handleAIGenerate}
            disabled={isGenerating || !aiPrompt.trim()}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate with AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Document Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              placeholder="Enter document title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="requirements">Requirements</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="meeting_notes">Meeting Notes</SelectItem>
                  <SelectItem value="process">Process</SelectItem>
                  <SelectItem value="guide">Guide</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Project *</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredProjects.length === 0 ? (
                    <SelectItem value="" disabled>No projects available</SelectItem>
                  ) : (
                    filteredProjects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tags (comma-separated)</Label>
            <Input
              placeholder="e.g., important, draft, review-needed"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Content *</Label>
            <div className="border rounded-lg overflow-hidden">
              <ReactQuill
                theme="snow"
                value={content}
                onChange={setContent}
                modules={modules}
                placeholder="Start writing your document or use AI to generate content..."
                style={{ minHeight: "300px" }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            {(title.trim() && content.trim()) && (
              <Button
                variant="outline"
                onClick={handleExportPdf}
                disabled={isExporting || isSaving}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" onClick={onCancel} disabled={isSaving || isExporting}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isExporting || !projectId}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {document ? "Update" : "Create"} Document
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

