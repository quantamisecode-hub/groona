import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Edit, 
  Calendar, 
  User, 
  Sparkles, 
  FileDown 
} from "lucide-react";
import { format } from "date-fns";
import { useUser } from "@/components/shared/UserContext"; // Import User Context for Tenant Details
import { generateBrandedDocumentPDF } from "@/components/insights/PDFReportGenerator"; // Import the new generator
import { toast } from "sonner";

export default function DocumentViewer({ document, onBack, onEdit, canEdit }) {
  const { user: currentUser, tenant } = useUser(); // Get Tenant Info for Branding
  const documentContentRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  if (!document) return null;

  // Safe date formatter to prevent crashes
  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) return "Invalid Date";
    return format(date, "MMM d, yyyy");
  };

  const handleExportPDF = async () => {
    // Check if document has content
    if (!document?.content) {
        toast.error("Document has no content to export.");
        return;
    }
    
    setIsExporting(true);
    
    try {
      // Use the new text-based generator with branding metadata
      const pdfBlob = await generateBrandedDocumentPDF(document.content, {
        logoUrl: tenant?.branding?.logo_url,
        companyName: tenant?.name,
        title: document.title,
        category: document.category,
        author: document.author_name || currentUser?.full_name,
        createdDate: document.created_date
      });

      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = window.document.createElement('a');
      link.href = url;
      // Sanitize filename
      link.download = `${document.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      window.document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      link.remove();

      toast.success("Document exported successfully!");
    } catch (error) {
      console.error("PDF Export failed:", error);
      toast.error("Failed to export PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const categoryColors = {
    general: "bg-slate-100 text-slate-800",
    requirements: "bg-blue-100 text-blue-800",
    technical: "bg-purple-100 text-purple-800",
    meeting_notes: "bg-green-100 text-green-800",
    process: "bg-orange-100 text-orange-800",
    guide: "bg-amber-100 text-amber-800",
  };

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Documents
        </Button>
        <div className="flex gap-2">
          {/* Export Button */}
          <Button 
            variant="outline" 
            onClick={handleExportPDF} 
            disabled={isExporting}
            className="gap-2"
          >
            <FileDown className="h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export to PDF'}
          </Button>

          {canEdit && (
            <Button onClick={() => onEdit(document)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Document
            </Button>
          )}
        </div>
      </div>

      {/* Document Container */}
      <Card className="shadow-lg border-slate-200">
        <CardHeader className="space-y-6 border-b border-slate-100 bg-slate-50/50 pb-8">
          <div className="space-y-4">
            {/* Title & AI Badge */}
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight">
                {document.title}
              </h1>
              {document.ai_generated && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-200 flex items-center gap-1 shrink-0 mt-1">
                  <Sparkles className="h-3 w-3" />
                  AI Generated
                </Badge>
              )}
            </div>

            {/* Tags & Category */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`${categoryColors[document.category] || "bg-slate-100 text-slate-800"} px-3 py-1 rounded-full border-0`}>
                {document.category ? document.category.replace("_", " ") : "General"}
              </Badge>
              {document.tags?.map((tag, i) => (
                <Badge key={i} variant="outline" className="border-slate-300 text-slate-600">
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Meta Information */}
            <div className="flex flex-wrap gap-6 text-sm text-slate-500 pt-2 border-t border-slate-200/60">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-400" />
                <span>
                  <span className="font-medium text-slate-700">Author:</span> {document.author_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>
                  <span className="font-medium text-slate-700">Created:</span>{" "}
                  {formatDate(document.created_date)}
                </span>
              </div>
              {document.last_edited_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span>
                    <span className="font-medium text-slate-700">Updated:</span>{" "}
                    {formatDate(document.last_edited_at)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 bg-white">
            {/* Content Display */}
            <div ref={documentContentRef} className="p-8 md:p-12">
                <div
                    className="prose prose-slate max-w-none 
                    
                    /* --- EXPLICIT HEADER OVERRIDES --- */
                    [&_h1]:text-4xl [&_h1]:font-extrabold [&_h1]:text-slate-900 [&_h1]:mb-6 [&_h1]:mt-8 [&_h1]:leading-tight
                    
                    [&_h2]:text-3xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:border-b [&_h2]:pb-2 [&_h2]:leading-tight
                    
                    [&_h3]:text-2xl [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-8 [&_h3]:mb-3
                    
                    [&_p]:text-base [&_p]:leading-relaxed [&_p]:text-slate-600 [&_p]:mb-4
                    
                    [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-6
                    [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-6
                    [&_li]:mb-2 [&_li]:text-slate-600 [&_li]:leading-relaxed
                    
                    [&_strong]:font-bold [&_strong]:text-slate-900
                    [&_b]:font-bold [&_b]:text-slate-900

                    [&_blockquote]:border-l-4 [&_blockquote]:border-blue-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:bg-slate-50 [&_blockquote]:py-2
                    "
                    dangerouslySetInnerHTML={{ __html: document.content }}
                />
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
