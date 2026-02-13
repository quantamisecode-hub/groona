import React, { useState, useMemo, useRef, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, Lightbulb, History, Trash2, FileText, Download } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/components/shared/UserContext";
import { format } from "date-fns";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

const suggestedQuestions = [
  "What are the biggest risks across all my projects?",
  "Which projects need immediate attention?",
  "How can I improve team productivity?",
  "What tasks are blocking progress?",
  "Predict completion dates for all active projects",
  "Which team members are overloaded?",
  "What's the overall health of my projects?",
  "Give me recommendations to speed up delivery",
];

export default function AskAIInsights({ projects, tasks, activities }) {
  const { user: currentUser, effectiveTenantId } = useUser();
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [displayedAnswer, setDisplayedAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const answerRef = useRef(null);
  const answerContainerRef = useRef(null);

  // Fetch users to map emails to names
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-insights'],
    queryFn: () => groonabackend.entities.User.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Create user map: email -> name
  const userMap = useMemo(() => {
    const map = {};
    allUsers.forEach(u => {
      if (u.email) {
        map[u.email] = u.full_name || u.email.split('@')[0];
      }
    });
    return map;
  }, [allUsers]);

  // Create project map: id -> name
  const projectMap = useMemo(() => {
    const map = {};
    projects.forEach(p => {
      if (p.id || p._id) {
        map[p.id || p._id] = p.name || 'Unnamed Project';
      }
    });
    return map;
  }, [projects]);

  // Fetch previous reports
  const { data: previousReports = [], refetch: refetchReports } = useQuery({
    queryKey: ['ai-insights-reports', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      try {
        return await groonabackend.entities.AIInsightsReport.filter({
          tenant_id: effectiveTenantId
        }, '-created_date');
      } catch (error) {
        console.error('Error fetching previous reports:', error);
        return [];
      }
    },
    enabled: !!effectiveTenantId,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (reportId) => {
      await groonabackend.entities.AIInsightsReport.delete(reportId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-insights-reports'] });
      toast.success('Report deleted successfully');
      // Clear selected report if it was deleted
      if (selectedReport?.id === selectedReport?.id) {
        setSelectedReport(null);
        setAnswer(null);
        setDisplayedAnswer("");
        setCurrentQuestion("");
      }
    },
    onError: (error) => {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report');
    }
  });

  // Typewriter effect function - faster speed
  const typewriterEffect = (text, speed = 5) => {
    return new Promise((resolve) => {
      let index = 0;
      setDisplayedAnswer("");
      setIsStreaming(true);

      const type = () => {
        if (index < text.length) {
          setDisplayedAnswer(text.substring(0, index + 1));
          index++;
          
          // Auto-scroll to bottom while typing (every 50 characters for performance)
          if (index % 50 === 0 && answerContainerRef.current) {
            setTimeout(() => {
              answerContainerRef.current?.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'end' 
              });
            }, 0);
          }
          
          setTimeout(type, speed);
        } else {
          setIsStreaming(false);
          // Final scroll
          setTimeout(() => {
            answerContainerRef.current?.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'end' 
            });
          }, 100);
          resolve();
        }
      };
      
      type();
    });
  };

  // Helper function to check if text contains dates (only dates should be bold in regular text)
  const containsDate = (text) => {
    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/, // Dates like 12/25/2024
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/i, // Date formats like Jan 15, 2024
      /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/i, // Date formats like 15 Jan 2024
      /\b\d{4}-\d{2}-\d{2}\b/, // ISO dates like 2024-01-15
    ];
    return datePatterns.some(pattern => pattern.test(text));
  };

  // Helper function to add text with formatting (handles bold markers and dates) - compressed
  const addFormattedText = (doc, text, x, y, maxWidth, fontSize = 8, forceBold = false, isListItem = false) => {
    // Remove markdown bold markers - extract bold text
    let processedText = text;
    const hasBoldMarkers = /\*\*.*?\*\*/.test(text);
    
    // Remove bold markers but keep the text
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, '$1');
    
    // For list items, check if there's a colon - only bold the part before colon
    if (isListItem && processedText.includes(':')) {
      const colonIndex = processedText.indexOf(':');
      const beforeColon = processedText.substring(0, colonIndex + 1); // Include the colon
      const afterColon = processedText.substring(colonIndex + 1).trim();
      
      let currentY = y;
      const lineHeight = fontSize * 0.4; // Reduced line height for compression
      doc.setFontSize(fontSize);
      
      // Calculate width of bold part to know where to start normal text
      doc.setFont("helvetica", "bold");
      const boldLines = doc.splitTextToSize(beforeColon, maxWidth);
      let lastBoldLineWidth = 0;
      if (boldLines.length > 0) {
        lastBoldLineWidth = doc.getTextWidth(boldLines[boldLines.length - 1]);
      }
      
      // Render the bold part (before colon)
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 20, 20);
      
      boldLines.forEach((line, index) => {
        if (currentY > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          currentY = 15;
        }
        doc.text(line, x, currentY);
        if (index === boldLines.length - 1) {
          // Last line of bold text - note the width
          lastBoldLineWidth = doc.getTextWidth(line);
        }
        currentY += lineHeight;
      });
      
      // Render the normal part (after colon) if it exists
      if (afterColon) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        
        // If the bold part didn't wrap, continue on same line
        if (boldLines.length === 1 && lastBoldLineWidth < maxWidth - 5) {
          // Continue on same line
          const remainingWidth = maxWidth - lastBoldLineWidth;
          const normalLines = doc.splitTextToSize(afterColon, remainingWidth);
          
          normalLines.forEach((line, index) => {
            if (index === 0) {
              // First line continues on same line as bold text
              const startX = x + lastBoldLineWidth;
              doc.text(line, startX, currentY - lineHeight);
              if (normalLines.length > 1) {
                currentY += lineHeight;
              }
            } else {
              // Subsequent lines start from x
              if (currentY > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                currentY = 15;
              }
              doc.text(line, x, currentY);
              currentY += lineHeight;
            }
          });
        } else {
          // Bold part wrapped, so normal text starts on new line
          const normalLines = doc.splitTextToSize(afterColon, maxWidth);
          
          normalLines.forEach((line) => {
            if (currentY > doc.internal.pageSize.getHeight() - 20) {
              doc.addPage();
              currentY = 15;
            }
            // Check if line contains dates - make dates bold
            if (containsDate(line)) {
              doc.setFont("helvetica", "bold");
              doc.setTextColor(20, 20, 20);
            } else {
              doc.setFont("helvetica", "normal");
              doc.setTextColor(50, 50, 50);
            }
            doc.text(line, x, currentY);
            currentY += lineHeight;
          });
        }
      }
      
      return currentY;
    }
    
    // For non-list items or list items without colon, use original logic
    const shouldBeBold = forceBold || hasBoldMarkers;
    
    // Split into lines for wrapping
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(processedText, maxWidth);
    let currentY = y;
    const lineHeight = fontSize * 0.45;
    
    lines.forEach((line) => {
      if (currentY > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        currentY = 15;
      }
      
      // Check if this specific line should be bold (forceBold, has bold markers, or contains dates)
      const lineShouldBeBold = shouldBeBold || containsDate(line);
      
      // Render the line with appropriate formatting
      if (lineShouldBeBold) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(20, 20, 20);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
      }
      
      doc.text(line, x, currentY);
      currentY += lineHeight;
    });
    
    return currentY;
  };

  // PDF download function with proper markdown formatting - compressed to 1 page
  const downloadPDF = async (report) => {
    try {
      toast.info('Generating PDF...');
      
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10; // Reduced margin
      const contentWidth = pageWidth - (margin * 2);
      let yPos = margin;

      // Header - compressed
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 50, 150);
      doc.text("AI Insights Report", margin, yPos);
      yPos += 6;

      // Question - compressed
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(50, 50, 50);
      const questionLines = doc.splitTextToSize(`Q: ${report.question}`, contentWidth);
      doc.text(questionLines, margin, yPos);
      yPos += questionLines.length * 4 + 3;

      // Metadata - compressed
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const metadata = `${report.generated_by_name || report.generated_by} | ${format(new Date(report.created_date || report.createdDate), 'MMM d, yyyy')}`;
      doc.text(metadata, margin, yPos);
      yPos += 5;

      // Divider
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4;

      // Parse and render markdown content - compressed
      const content = report.report_content || "";
      // Truncate content if too long to fit on one page
      const maxChars = 1500; // Approximate max for one page
      const truncatedContent = content.length > maxChars 
        ? content.substring(0, maxChars) + '...' 
        : content;
      const lines = truncatedContent.split('\n');
      const lineHeight = 4; // Reduced line height
      const bulletIndent = 3;

      for (const line of lines) {
        // Check for page break
        if (yPos > pageHeight - margin - 15) {
          doc.addPage();
          yPos = margin;
        }

        const trimmedLine = line.trim();
        
        // Check if we're running out of space - stop if near bottom
        if (yPos > pageHeight - margin - 20) {
          break; // Stop adding content if we're near the bottom
        }

        // Handle headers - compressed sizes
        if (trimmedLine.startsWith('### ')) {
          // H3
          yPos += 2;
          const headerText = trimmedLine.substring(4).replace(/\*\*(.*?)\*\*/g, '$1');
          yPos = addFormattedText(doc, headerText, margin, yPos, contentWidth, 9, true);
          yPos += 2;
        } else if (trimmedLine.startsWith('## ')) {
          // H2
          yPos += 2;
          const headerText = trimmedLine.substring(3).replace(/\*\*(.*?)\*\*/g, '$1');
          yPos = addFormattedText(doc, headerText, margin, yPos, contentWidth, 10, true);
          yPos += 2;
        } else if (trimmedLine.startsWith('# ')) {
          // H1
          yPos += 2;
          const headerText = trimmedLine.substring(2).replace(/\*\*(.*?)\*\*/g, '$1');
          yPos = addFormattedText(doc, headerText, margin, yPos, contentWidth, 11, true);
          yPos += 2;
        } else if (trimmedLine.match(/^[-*+]\s+/)) {
          const bulletText = trimmedLine.replace(/^[-*+]\s+/, '');
          const bulletX = margin + bulletIndent;
          
          // Draw bullet - compressed
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(50, 50, 50);
          doc.text('•', margin, yPos);
          
          // Render bullet text with formatting - compressed font
          yPos = addFormattedText(doc, bulletText, bulletX, yPos, contentWidth - bulletIndent, 8, false, true);
          yPos += 1.5;
        } else if (trimmedLine.match(/^\d+\.\s+/)) {
          // Numbered list - compressed
          const match = trimmedLine.match(/^(\d+)\.\s+(.*)/);
          if (match) {
            const number = match[1];
            const listText = match[2];
            const listX = margin + bulletIndent;
            
            // Draw number
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(50, 50, 50);
            doc.text(`${number}.`, margin, yPos);
            
            // Render list text with formatting - compressed
            yPos = addFormattedText(doc, listText, listX, yPos, contentWidth - bulletIndent, 8, false, true);
            yPos += 1.5;
          }
        } else if (trimmedLine.length > 0) {
          // Regular paragraph - compressed
          yPos = addFormattedText(doc, trimmedLine, margin, yPos, contentWidth, 8);
          yPos += 2;
        } else {
          // Empty line - minimal spacing
          yPos += 1;
        }
      }

      // Compress and save
      const pdfBlob = doc.output('blob');
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      const filename = `AI-Insights-${format(new Date(report.created_date || report.createdDate), 'yyyy-MM-dd')}-${report.question.substring(0, 30).replace(/[^a-z0-9]/gi, '_')}.pdf`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  // Auto-scroll effect when answer changes or while streaming
  useEffect(() => {
    if ((displayedAnswer || answer) && answerContainerRef.current) {
      const scrollToBottom = () => {
        if (answerContainerRef.current) {
          answerContainerRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'end' 
          });
        }
      };
      
      // Scroll immediately and also after a short delay for better UX
      scrollToBottom();
      const timeout = setTimeout(scrollToBottom, 200);
      
      return () => clearTimeout(timeout);
    }
  }, [displayedAnswer, answer, isStreaming]);

  const handleAsk = async (customQuestion = null) => {
    const queryQuestion = customQuestion || question;
    if (!queryQuestion.trim()) return;

    setIsLoading(true);
    setAnswer(null);

    try {
      // Helper function to format dates (remove timestamps)
      const formatDate = (dateStr) => {
        if (!dateStr) return null;
        try {
          const date = new Date(dateStr);
          return format(date, 'MMM d, yyyy');
        } catch {
          return dateStr;
        }
      };

      // Prepare clean, concise context data
      const contextData = {
        projects: projects.map(p => ({
          name: p.name || 'Unnamed Project',
          status: p.status,
          progress: p.progress || 0,
          deadline: formatDate(p.deadline),
          priority: p.priority,
        })),
        tasks: tasks.map(t => {
          // Map assigned_to emails to names
          const assignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
          const assigneeNames = assignees
            .filter(Boolean)
            .map(email => userMap[email] || email.split('@')[0])
            .filter(Boolean);
          
          // Map project_id to project name
          const projectName = projectMap[t.project_id] || 'Unknown Project';
          
          return {
            title: t.title,
            status: t.status,
            priority: t.priority,
            due_date: formatDate(t.due_date),
            assigned_to: assigneeNames.length > 0 ? assigneeNames : ['Unassigned'],
            project_name: projectName, // Use project name, not ID
          };
        }),
        summary: {
          totalProjects: projects.length,
          activeProjects: projects.filter(p => p.status === 'active').length,
          totalTasks: tasks.length,
          completedTasks: tasks.filter(t => t.status === 'completed').length,
          overdueTasks: tasks.filter(t => {
            if (!t.due_date || t.status === 'completed') return false;
            return new Date(t.due_date) < new Date();
          }).length,
        }
      };

      const prompt = `You are an expert project management analyst. Analyze the following project data and provide a VERY CONCISE, actionable answer that fits on ONE PAGE.

CRITICAL INSTRUCTIONS:
- Use team member NAMES (not emails) - they are already provided in the data
- Use project NAMES (not IDs) - they are already provided in the data
- Format dates as "Jan 15, 2026" (not timestamps)
- Keep response EXTREMELY CONCISE - maximum 200 words total
- Use bullet points only - no long paragraphs
- Focus on TOP 3-4 most critical insights only
- Provide 2-3 actionable recommendations maximum
- Be direct and brief - every word counts
- Do NOT show email addresses or IDs - use names only

PROJECT DATA:
${JSON.stringify(contextData, null, 2)}

QUESTION: ${queryQuestion}

Provide a VERY CONCISE answer (max 200 words):
1. Direct answer (1-2 sentences only)
2. Top 3-4 key insights (bullet points, one line each)
3. 2-3 actionable recommendations (bullet points, one line each)

Keep it extremely brief and focused.`;

      const result = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false,
      });

      setAnswer(result);
      setCurrentQuestion(queryQuestion);
      
      // Start typewriter effect - faster speed
      await typewriterEffect(result, 5);
      
      if (!customQuestion) {
        setQuestion("");
      }

      // Save report to database - truncate if too large to avoid 413 errors
      if (effectiveTenantId && currentUser) {
        try {
          // Truncate report content if it's too large (limit to 800KB to avoid 413 error)
          const maxReportLength = 800000; // 800KB limit
          let reportContentToSave = result;
          let wasTruncated = false;
          
          if (result.length > maxReportLength) {
            reportContentToSave = result.substring(0, maxReportLength) + '\n\n---\n\n**Note:** This report was truncated due to size limitations. The full report content is available in the AI report display above.';
            wasTruncated = true;
            console.warn('[AskAIInsights] Report content truncated due to size limit:', {
              original_length: result.length,
              truncated_length: reportContentToSave.length
            });
          }

          console.log('[AskAIInsights] Attempting to save report:', {
            tenant_id: effectiveTenantId,
            question: queryQuestion,
            generated_by: currentUser.email,
            content_length: reportContentToSave.length,
            was_truncated: wasTruncated
          });

          const savedReport = await groonabackend.entities.AIInsightsReport.create({
            tenant_id: effectiveTenantId,
            question: queryQuestion,
            report_content: reportContentToSave,
            generated_by: currentUser.email,
            generated_by_name: currentUser.full_name || currentUser.email,
            context_data: contextData,
            is_truncated: wasTruncated,
            original_length: wasTruncated ? result.length : undefined
          });
          
          console.log('[AskAIInsights] Report saved successfully:', savedReport);
          
          // Invalidate and refetch reports
          await queryClient.invalidateQueries({ queryKey: ['ai-insights-reports', effectiveTenantId] });
          await refetchReports();
          
          if (wasTruncated) {
            toast.success('Report generated and saved (truncated due to size). Full report displayed above.');
          } else {
            toast.success('Report generated and saved successfully');
          }
        } catch (error) {
          console.error('[AskAIInsights] Error saving report:', error);
          console.error('[AskAIInsights] Error details:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            response: error.response?.data
          });
          
          // If still getting 413, try with even smaller content
          if (error.response?.status === 413) {
            try {
              const smallerLimit = 500000;
              const smallerContent = result.substring(0, smallerLimit) + '\n\n---\n\n**Note:** This report was significantly truncated due to size limitations. The full report content is available in the AI report display above.';
              
              console.log('[AskAIInsights] Retrying with smaller content:', {
                content_length: smallerContent.length
              });
              
              const savedReport = await groonabackend.entities.AIInsightsReport.create({
                tenant_id: effectiveTenantId,
                question: queryQuestion,
                report_content: smallerContent,
                generated_by: currentUser.email,
                generated_by_name: currentUser.full_name || currentUser.email,
                context_data: contextData,
                is_truncated: true,
                original_length: result.length
              });
              
              await queryClient.invalidateQueries({ queryKey: ['ai-insights-reports', effectiveTenantId] });
              await refetchReports();
              
              toast.success('Report generated and saved (truncated). Full report displayed above.');
            } catch (retryError) {
              console.error('[AskAIInsights] Retry also failed:', retryError);
              toast.error('Report generated but too large to save. Full report is displayed above.');
            }
          } else {
            const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
            toast.error(`Report generated but failed to save: ${errorMessage}`);
          }
        }
      }
    } catch (error) {
      console.error('Error getting AI insights:', error);
      const errorMessage = "Sorry, I couldn't generate insights at this moment. Please try again.";
      setAnswer(errorMessage);
      await typewriterEffect(errorMessage, 5);
    }
    setIsLoading(false);
    setIsStreaming(false);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Ask AI for Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about your projects, tasks, risks, timelines, or team performance..."
              rows={4}
              className="bg-white border-slate-200"
              disabled={isLoading}
            />
            <div className="flex justify-end">
              <Button
                onClick={() => handleAsk()}
                disabled={!question.trim() || isLoading}
                className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Ask AI
                  </>
                )}
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-medium text-slate-700">Suggested Questions:</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuestion(q);
                    handleAsk(q);
                  }}
                  disabled={isLoading}
                  className="text-xs border-slate-200 hover:bg-slate-50"
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout: Answer on left, History on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - AI Answer */}
        <div className="lg:col-span-2" ref={answerContainerRef}>
          {(answer || displayedAnswer || isLoading) && (
            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  AI Insights
                  {currentQuestion && (
                    <Badge variant="outline" className="ml-2 bg-purple-100 text-purple-700 border-purple-200 text-xs">
                      {currentQuestion.length > 50 ? currentQuestion.substring(0, 50) + '...' : currentQuestion}
                    </Badge>
                  )}
                  {isStreaming && (
                    <Badge variant="outline" className="ml-2 bg-purple-100 text-purple-700 border-purple-200 text-xs animate-pulse">
                      Generating...
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none" ref={answerRef}>
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h1 className="text-xl font-bold text-slate-900 mt-4 mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-semibold text-slate-900 mt-3 mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-semibold text-slate-900 mt-2 mb-1">{children}</h3>,
                      p: ({ children }) => <p className="text-slate-700 mb-2">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside text-slate-700 space-y-1 mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside text-slate-700 space-y-1 mb-2">{children}</ol>,
                      li: ({ children }) => <li className="text-slate-700">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                      code: ({ children }) => <code className="px-1 py-0.5 rounded bg-slate-200 text-slate-800 text-sm">{children}</code>,
                    }}
                  >
                    {displayedAnswer || answer || ""}
                  </ReactMarkdown>
                  {isStreaming && (
                    <span className="inline-block w-2 h-4 bg-purple-600 ml-1 animate-pulse">|</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {!answer && (
            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
              <CardContent className="p-12 text-center">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-purple-300" />
                <h4 className="font-semibold text-slate-900 mb-2">AI-Powered Insights</h4>
                <p className="text-slate-600">
                  Ask a question above to get AI-generated insights about your projects, tasks, and team performance.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - History */}
        <div className="lg:col-span-1">
          <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4 text-purple-600" />
                  Report History
                </CardTitle>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  {previousReports.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-y-auto">
                {previousReports.length > 0 ? (
                  <div className="space-y-2">
                    {previousReports.map((report) => (
                      <div
                        key={report.id || report._id}
                        onClick={() => {
                          setSelectedReport(report);
                          setAnswer(report.report_content);
                          setDisplayedAnswer(report.report_content);
                          setCurrentQuestion(report.question);
                        }}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          (selectedReport?.id === report.id || selectedReport?._id === report._id)
                            ? 'bg-purple-100 border-purple-400 shadow-md'
                            : 'bg-white border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="h-4 w-4 text-purple-600 flex-shrink-0" />
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {report.question.length > 40 ? report.question.substring(0, 40) + '...' : report.question}
                              </p>
                            </div>
                            <div className="text-xs text-slate-600 space-y-1">
                              <p className="truncate">
                                By: {report.generated_by_name || report.generated_by}
                              </p>
                              <p>{format(new Date(report.created_date || report.createdDate), 'MMM d, yyyy HH:mm')}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadPDF(report);
                              }}
                              className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex-shrink-0"
                              title="Download PDF"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this report?')) {
                                  deleteReportMutation.mutate(report.id || report._id);
                                }
                              }}
                              disabled={deleteReportMutation.isPending}
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                              title="Delete report"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm text-slate-600">No reports yet</p>
                    <p className="text-xs text-slate-500 mt-1">Generated reports will appear here</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

