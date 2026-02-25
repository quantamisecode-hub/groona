import React, { useState, useRef, useMemo, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateProjectReportPDF } from "./PDFReportGenerator";
import { jsPDF } from "jspdf";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/components/shared/UserContext";
import {
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  Target,
  Users,
  Clock,
  Loader2,
  Sparkles,
  History,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from 'react-markdown';
import { toast } from "sonner";

export default function ProjectReport({ project, tasks, activities }) {
  const { user: currentUser, effectiveTenantId } = useUser();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [displayedReport, setDisplayedReport] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const reportRef = useRef(null);
  const reportContainerRef = useRef(null);

  // Fetch user profiles to map emails to names and titles
  const { data: userProfiles = [] } = useQuery({
    queryKey: ['user-profiles'],
    queryFn: () => groonabackend.entities.UserProfile.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Create a lookup map for fast access: email -> { name, title }
  const userMap = useMemo(() => {
    const map = {};
    userProfiles.forEach(p => {
      if (p.user_email) {
        map[p.user_email] = {
          name: p.full_name || p.user_email,
          title: p.job_title || 'Team Member'
        };
      }
    });
    return map;
  }, [userProfiles]);

  const generateAnalytics = () => {
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const pendingTasks = tasks.filter(t => t.status !== 'completed');
    const overdueTasks = tasks.filter(t => {
      if (!t.due_date || t.status === 'completed') return false;
      return new Date(t.due_date) < new Date();
    });

    const tasksByStatus = {
      todo: tasks.filter(t => t.status === 'todo').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      review: tasks.filter(t => t.status === 'review').length,
      completed: completedTasks.length,
    };

    // Fix: Correctly flatten and deduplicate assigned users
    const allAssignees = tasks.flatMap(t => {
      if (Array.isArray(t.assigned_to)) return t.assigned_to;
      if (typeof t.assigned_to === 'string') return [t.assigned_to];
      return [];
    }).filter(Boolean);

    const assignedUsers = [...new Set(allAssignees)];

    const recentActivities = activities.slice(0, 10);

    return {
      completedTasks,
      pendingTasks,
      overdueTasks,
      tasksByStatus,
      assignedUsers,
      recentActivities,
      completionRate: tasks.length > 0 ? ((completedTasks.length / tasks.length) * 100).toFixed(0) : 0,
    };
  };

  const analytics = generateAnalytics();

  // Fetch previous reports
  const { data: previousReports = [], refetch: refetchReports } = useQuery({
    queryKey: ['project-reports', project.id, effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId || !project.id) return [];
      try {
        return await groonabackend.entities.ProjectReport.filter({
          tenant_id: effectiveTenantId,
          project_id: project.id
        }, '-created_date');
      } catch (error) {
        console.error('Error fetching previous reports:', error);
        return [];
      }
    },
    enabled: !!effectiveTenantId && !!project.id,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (reportId) => {
      await groonabackend.entities.ProjectReport.delete(reportId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-reports'] });
      toast.success('Report deleted successfully');
      if (selectedReport?.id === selectedReport?.id) {
        setSelectedReport(null);
        setAiReport(null);
        setDisplayedReport("");
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
      setDisplayedReport("");
      setIsStreaming(true);

      const type = () => {
        if (index < text.length) {
          setDisplayedReport(text.substring(0, index + 1));
          index++;

          // Auto-scroll to bottom while typing (every 50 characters for performance)
          if (index % 50 === 0 && reportContainerRef.current) {
            setTimeout(() => {
              reportContainerRef.current?.scrollIntoView({
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
            reportContainerRef.current?.scrollIntoView({
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

  // Auto-scroll effect when report changes or while streaming
  useEffect(() => {
    if ((displayedReport || aiReport) && reportContainerRef.current) {
      const scrollToBottom = () => {
        if (reportContainerRef.current) {
          reportContainerRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'end'
          });
        }
      };

      scrollToBottom();
      const timeout = setTimeout(scrollToBottom, 200);

      return () => clearTimeout(timeout);
    }
  }, [displayedReport, aiReport, isStreaming]);

  const generateAIReport = async () => {
    setIsGenerating(true);
    try {
      // Calculate velocity
      const now = new Date();
      const last30DaysCompletedTasks = activities.filter(a => {
        const activityDate = new Date(a.created_date);
        const daysDiff = Math.ceil((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff <= 30 && a.action === 'completed' && a.entity_type === 'task';
      });
      const velocity = (last30DaysCompletedTasks.length / 30).toFixed(2);

      const prompt = `Generate a comprehensive executive project report for the following project:

Project Name: ${project.name}
Description: ${project.description || 'No description'}
Status: ${project.status}
Progress: ${project.progress || 0}%
Deadline: ${project.deadline ? format(new Date(project.deadline), 'MMM d, yyyy') : 'Not set'}
Priority: ${project.priority || 'Not set'}

Task Statistics:
- Total Tasks: ${tasks.length}
- Completed: ${analytics.completedTasks.length} (${analytics.completionRate}%)
- In Progress: ${analytics.tasksByStatus.in_progress}
- Pending: ${analytics.tasksByStatus.todo}
- In Review: ${analytics.tasksByStatus.review}
- Overdue: ${analytics.overdueTasks.length}

Performance Metrics:
- Completion Velocity: ${velocity} tasks/day
- Team Members: ${analytics.assignedUsers.length}
- Recent Activity: ${analytics.recentActivities.length} actions in last 10 entries

Recent Activities:
${analytics.recentActivities.slice(0, 5).map(a => `- ${a.user_name} ${a.action} ${a.entity_type}: ${a.entity_name}`).join('\n')}

Provide a VERY CONCISE executive report (max 300 words, fit on ONE PAGE) with:

1. **Executive Summary** (1-2 sentences only)
2. **Key Achievements** (Top 3 bullet points, one line each)
3. **Current Bottlenecks** (Top 2 bullet points, one line each)
4. **Risk Assessment** (Top 3 bullet points, one line each)
5. **Team Performance** (1-2 bullet points, one line each)
6. **Strategic Recommendations** (Top 3 actionable items, one line each)

CRITICAL: Keep it EXTREMELY BRIEF. Maximum 300 words total. Use bullet points only. No long paragraphs. Be direct and concise.`;

      const result = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false,
      });

      setAiReport(result);

      // Start typewriter effect - faster speed
      await typewriterEffect(result, 5);

      // Save report to database - truncate if too large to avoid 413 errors
      if (effectiveTenantId && currentUser && project.id) {
        try {
          // Truncate report content if it's too large (limit to 800KB to avoid 413 error)
          // Server limit is now 1MB, so we use 800KB as a safe buffer
          const maxReportLength = 800000; // 800KB limit
          let reportContentToSave = result;
          let wasTruncated = false;

          if (result.length > maxReportLength) {
            // Truncate and add a note
            reportContentToSave = result.substring(0, maxReportLength) + '\n\n---\n\n**Note:** This report was truncated due to size limitations. The full report content is available in the AI report display above.';
            wasTruncated = true;
            console.warn('[ProjectReport] Report content truncated due to size limit:', {
              original_length: result.length,
              truncated_length: reportContentToSave.length
            });
          }

          console.log('[ProjectReport] Attempting to save report:', {
            tenant_id: effectiveTenantId,
            project_id: project.id,
            project_name: project.name,
            generated_by: currentUser.email,
            content_length: reportContentToSave.length,
            was_truncated: wasTruncated
          });

          const savedReport = await groonabackend.entities.ProjectReport.create({
            tenant_id: effectiveTenantId,
            project_id: project.id,
            project_name: project.name,
            report_content: reportContentToSave,
            generated_by: currentUser.email,
            generated_by_name: currentUser.full_name || currentUser.email,
            analytics_data: analytics,
            is_truncated: wasTruncated,
            original_length: wasTruncated ? result.length : undefined
          });

          console.log('[ProjectReport] Report saved successfully:', savedReport);

          // Invalidate and refetch reports
          await queryClient.invalidateQueries({ queryKey: ['project-reports', project.id, effectiveTenantId] });
          await refetchReports();

          if (wasTruncated) {
            toast.success('Report generated and saved (truncated due to size). Full report displayed above.');
          } else {
            toast.success('Report generated and saved successfully');
          }
        } catch (error) {
          console.error('[ProjectReport] Error saving report:', error);
          console.error('[ProjectReport] Error details:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            response: error.response?.data
          });

          // If still getting 413, try with even smaller content
          if (error.response?.status === 413) {
            try {
              // Try with even smaller limit (500KB)
              const smallerLimit = 500000;
              const smallerContent = result.substring(0, smallerLimit) + '\n\n---\n\n**Note:** This report was significantly truncated due to size limitations. The full report content is available in the AI report display above.';

              console.log('[ProjectReport] Retrying with smaller content:', {
                content_length: smallerContent.length
              });

              const savedReport = await groonabackend.entities.ProjectReport.create({
                tenant_id: effectiveTenantId,
                project_id: project.id,
                project_name: project.name,
                report_content: smallerContent,
                generated_by: currentUser.email,
                generated_by_name: currentUser.full_name || currentUser.email,
                analytics_data: analytics,
                is_truncated: true,
                original_length: result.length
              });

              await queryClient.invalidateQueries({ queryKey: ['project-reports', project.id, effectiveTenantId] });
              await refetchReports();

              toast.success('Report generated and saved (truncated). Full report displayed above.');
            } catch (retryError) {
              console.error('[ProjectReport] Retry also failed:', retryError);
              toast.error('Report generated but too large to save. Full report is displayed above and can be exported as PDF.');
            }
          } else {
            // Show more detailed error message for other errors
            const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
            toast.error(`Report generated but failed to save: ${errorMessage}`);
          }
        }
      } else {
        console.warn('[ProjectReport] Missing required data for saving:', {
          effectiveTenantId,
          currentUser: !!currentUser,
          projectId: project.id
        });
        toast.error('Missing required data to save report');
      }

      return result;
    } catch (error) {
      console.error('Error generating AI report:', error);
      const errorMessage = "Error generating report. Please try again.";
      setAiReport(errorMessage);
      await typewriterEffect(errorMessage, 5);
      toast.error('Failed to generate report');
      return errorMessage;
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);
    }
  };

  const scheduleReport = async () => {
    setIsScheduling(true);
    try {
      let currentAiReport = aiReport;
      if (!currentAiReport) {
        currentAiReport = await generateAIReport();
      }

      // Allow state to settle
      await new Promise(resolve => setTimeout(resolve, 500));

      // UPDATED: Use the new efficient text-based generator
      // Note: Passing userMap so names appear in PDF instead of just emails
      const pdfBlob = await generateProjectReportPDF(project, analytics, currentAiReport, userMap);

      if (!pdfBlob) throw new Error("Failed to generate PDF");

      const file = new File([pdfBlob], `${project.name.replace(/\s+/g, '-')}-report.pdf`, { type: 'application/pdf' });
      const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });

      const user = await groonabackend.auth.me();
      await groonabackend.integrations.Core.SendEmail({
        to: user.email,
        subject: `Project Report: ${project.name}`,
        body: `
          <h2>Project Report: ${project.name}</h2>
          <p>Please find your generated project report attached below.</p>
          <p><a href="${file_url}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Download PDF Report</a></p>
          <p>Generated on ${format(new Date(), 'PPpp')}</p>
        `,
      });

      alert('PDF Report sent to your email!');
    } catch (error) {
      console.error('Error scheduling report:', error);
      alert('Error sending report. Please try again.');
    } finally {
      setIsScheduling(false);
    }
  };

  const downloadReport = async () => {
    try {
      // Download report WITHOUT AI report - only project analytics
      const pdfBlob = generateProjectReportPDF(project, analytics, null, userMap);

      if (!pdfBlob) {
        toast.error('Failed to generate PDF');
        return;
      }

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.name.replace(/\s+/g, '-')}-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Project report downloaded successfully');
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Failed to generate PDF');
    }
  };

  // Helper function to check if text contains dates
  const containsDate = (text) => {
    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/i,
      /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/i,
      /\b\d{4}-\d{2}-\d{2}\b/,
    ];
    return datePatterns.some(pattern => pattern.test(text));
  };

  // Helper function to add text with formatting (handles bold markers and dates) - compressed
  const addFormattedText = (doc, text, x, y, maxWidth, fontSize = 8, forceBold = false, isListItem = false) => {
    let processedText = text;
    const hasBoldMarkers = /\*\*.*?\*\*/.test(text);

    processedText = processedText.replace(/\*\*(.*?)\*\*/g, '$1');

    // For list items, check if there's a colon - only bold the part before colon
    if (isListItem && processedText.includes(':')) {
      const colonIndex = processedText.indexOf(':');
      const beforeColon = processedText.substring(0, colonIndex + 1);
      const afterColon = processedText.substring(colonIndex + 1).trim();

      let currentY = y;
      const lineHeight = fontSize * 0.4; // Reduced line height for compression
      doc.setFontSize(fontSize);

      doc.setFont("helvetica", "bold");
      const boldLines = doc.splitTextToSize(beforeColon, maxWidth);
      let lastBoldLineWidth = 0;
      if (boldLines.length > 0) {
        lastBoldLineWidth = doc.getTextWidth(boldLines[boldLines.length - 1]);
      }

      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 20, 20);

      boldLines.forEach((line, index) => {
        if (currentY > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          currentY = 15;
        }
        doc.text(line, x, currentY);
        if (index === boldLines.length - 1) {
          lastBoldLineWidth = doc.getTextWidth(line);
        }
        currentY += lineHeight;
      });

      if (afterColon) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);

        if (boldLines.length === 1 && lastBoldLineWidth < maxWidth - 5) {
          const remainingWidth = maxWidth - lastBoldLineWidth;
          const normalLines = doc.splitTextToSize(afterColon, remainingWidth);

          normalLines.forEach((line, index) => {
            if (index === 0) {
              const startX = x + lastBoldLineWidth;
              doc.text(line, startX, currentY - lineHeight);
              if (normalLines.length > 1) {
                currentY += lineHeight;
              }
            } else {
              if (currentY > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                currentY = 15;
              }
              if (containsDate(line)) {
                doc.setFont("helvetica", "bold");
                doc.setTextColor(20, 20, 20);
              } else {
                doc.setFont("helvetica", "normal");
                doc.setTextColor(50, 50, 50);
              }
              doc.text(line, x, currentY);
              currentY += lineHeight;
            }
          });
        } else {
          const normalLines = doc.splitTextToSize(afterColon, maxWidth);

          normalLines.forEach((line) => {
            if (currentY > doc.internal.pageSize.getHeight() - 20) {
              doc.addPage();
              currentY = 15;
            }
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

    const shouldBeBold = forceBold || hasBoldMarkers;

    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(processedText, maxWidth);
    let currentY = y;
    const lineHeight = fontSize * 0.45;

    lines.forEach((line) => {
      if (currentY > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        currentY = 15;
      }

      const lineShouldBeBold = shouldBeBold || containsDate(line);

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

  // Function to export ONLY AI report as PDF with proper formatting - compressed to 1 page
  const exportAIReportPDF = (aiReportContent) => {
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
    doc.text("AI Executive Report", margin, yPos);
    yPos += 5;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text(project.name, margin, yPos);
    yPos += 5;

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(format(new Date(), 'MMM d, yyyy'), margin, yPos);
    yPos += 5;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    // Parse and render markdown content - compressed
    const content = aiReportContent || "";
    // Truncate content if too long to fit on one page
    const maxChars = 2000; // Approximate max for one page
    const truncatedContent = content.length > maxChars
      ? content.substring(0, maxChars) + '...'
      : content;
    const lines = truncatedContent.split('\n');
    const lineHeight = 4; // Reduced line height
    const bulletIndent = 3;

    // Use regular for loop to allow early exit
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if we're running out of space - stop if near bottom
      if (yPos > pageHeight - margin - 20) {
        break; // Stop adding content if we're near the bottom
      }

      if (yPos > pageHeight - margin - 15) {
        doc.addPage();
        yPos = margin;
      }

      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('### ')) {
        yPos += 2;
        const headerText = trimmedLine.substring(4).replace(/\*\*(.*?)\*\*/g, '$1');
        yPos = addFormattedText(doc, headerText, margin, yPos, contentWidth, 9, true);
        yPos += 2;
      } else if (trimmedLine.startsWith('## ')) {
        yPos += 2;
        const headerText = trimmedLine.substring(3).replace(/\*\*(.*?)\*\*/g, '$1');
        yPos = addFormattedText(doc, headerText, margin, yPos, contentWidth, 10, true);
        yPos += 2;
      } else if (trimmedLine.startsWith('# ')) {
        yPos += 2;
        const headerText = trimmedLine.substring(2).replace(/\*\*(.*?)\*\*/g, '$1');
        yPos = addFormattedText(doc, headerText, margin, yPos, contentWidth, 11, true);
        yPos += 2;
      } else if (trimmedLine.match(/^[-*+]\s+/)) {
        const bulletText = trimmedLine.replace(/^[-*+]\s+/, '');
        const bulletX = margin + bulletIndent;

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(50, 50, 50);
        doc.text('•', margin, yPos);

        yPos = addFormattedText(doc, bulletText, bulletX, yPos, contentWidth - bulletIndent, 8, false, true);
        yPos += 1.5;
      } else if (trimmedLine.match(/^\d+\.\s+/)) {
        const match = trimmedLine.match(/^(\d+)\.\s+(.*)/);
        if (match) {
          const number = match[1];
          const listText = match[2];
          const listX = margin + bulletIndent;

          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(50, 50, 50);
          doc.text(`${number}.`, margin, yPos);

          yPos = addFormattedText(doc, listText, listX, yPos, contentWidth - bulletIndent, 8, false, true);
          yPos += 1.5;
        }
      } else if (trimmedLine.length > 0) {
        yPos = addFormattedText(doc, trimmedLine, margin, yPos, contentWidth, 8);
        yPos += 2;
      } else {
        yPos += 1;
      }
    }

    return doc.output('blob');
  };

  return (
    <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Project Summary Report: {project.name}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={scheduleReport}
              disabled={isScheduling}
              className="border-slate-200"
            >
              {isScheduling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Email Report
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadReport}
              className="border-slate-200"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6" ref={reportRef}>
        <div className="bg-white p-2">
          {/* Overview */}
          <div className="p-6 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Project Overview</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600 mb-1">Status</p>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 border">
                  {project.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Progress</p>
                <p className="text-2xl font-bold text-slate-900">{project.progress || 0}%</p>
              </div>
              {project.deadline && (
                <div>
                  <p className="text-sm text-slate-600 mb-1">Deadline</p>
                  <p className="font-semibold text-slate-900">
                    {format(new Date(project.deadline), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-slate-600 mb-1">Created</p>
                <p className="font-semibold text-slate-900">
                  {format(new Date(project.created_date), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 my-8 mb-4">Key Metrics</h3>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-medium text-slate-600">Completed</p>
                </div>
                <p className="text-2xl font-bold text-green-600">{analytics.completedTasks.length}</p>
              </div>

              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <p className="text-sm font-medium text-slate-600">In Progress</p>
                </div>
                <p className="text-2xl font-bold text-blue-600">{analytics.tasksByStatus.in_progress}</p>
              </div>

              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-5 w-5 text-amber-600" />
                  <p className="text-sm font-medium text-slate-600">Pending</p>
                </div>
                <p className="text-2xl font-bold text-amber-600">{analytics.tasksByStatus.todo}</p>
              </div>

              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <p className="text-sm font-medium text-slate-600">Overdue</p>
                </div>
                <p className="text-2xl font-bold text-red-600">{analytics.overdueTasks.length}</p>
              </div>
            </div>
          </div>

          {/* Team Information */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 my-8 mb-4">Team</h3>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-5 w-5 text-slate-600" />
                <p className="font-semibold text-slate-900">
                  {analytics.assignedUsers.length} Team Member{analytics.assignedUsers.length !== 1 ? 's' : ''} Assigned
                </p>
              </div>
              {analytics.assignedUsers.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-3">
                  {analytics.assignedUsers.map((email, index) => {
                    const profile = userMap[email];
                    return (
                      <Badge key={index} variant="outline" className="bg-white px-3 py-1">
                        {profile ? (
                          <span className="flex items-center gap-1">
                            <span className="font-semibold">{profile.name}</span>
                            <span className="text-slate-400 mx-1">|</span>
                            <span className="text-slate-600 text-xs">{profile.title}</span>
                          </span>
                        ) : email}
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-600">No tasks assigned yet</p>
              )}
            </div>
          </div>

          {/* Reports List Pane and AI Report Section */}
          <div className="border-slate-200 pt-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Pane - Reports List */}
              <div className="lg:col-span-1">
                <div className="sticky top-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <History className="h-5 w-5 text-purple-600" />
                      Report History
                    </h3>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      {previousReports.length}
                    </Badge>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 max-h-[300px] lg:max-h-[600px] overflow-y-auto">
                    {previousReports.length > 0 ? (
                      <div className="space-y-2">
                        {previousReports.map((report) => (
                          <div
                            key={report.id}
                            onClick={() => {
                              setSelectedReport(report);
                              setAiReport(report.report_content);
                              setDisplayedReport(report.report_content);
                            }}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedReport?.id === report.id
                              ? 'bg-purple-100 border-purple-400 shadow-md'
                              : 'bg-white border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                              }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <FileText className="h-4 w-4 text-purple-600 flex-shrink-0" />
                                  <p className="text-sm font-semibold text-slate-900 truncate">
                                    {report.project_name}
                                  </p>
                                </div>
                                <div className="text-xs text-slate-600 space-y-1">
                                  <p className="truncate">
                                    By: {report.generated_by_name || report.generated_by}
                                  </p>
                                  <p>{format(new Date(report.created_date), 'MMM d, yyyy HH:mm')}</p>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    try {
                                      const pdfBlob = exportAIReportPDF(report.report_content);
                                      if (!pdfBlob) {
                                        toast.error('Failed to generate PDF');
                                        return;
                                      }
                                      const url = URL.createObjectURL(pdfBlob);
                                      const link = document.createElement('a');
                                      link.href = url;
                                      const filename = `${report.project_name?.replace(/\s+/g, '-') || 'report'}-ai-executive-report-${format(new Date(report.created_date), 'yyyy-MM-dd')}.pdf`;
                                      link.download = filename;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      URL.revokeObjectURL(url);
                                      toast.success('PDF downloaded successfully');
                                    } catch (error) {
                                      console.error('Error generating PDF:', error);
                                      toast.error('Failed to generate PDF');
                                    }
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
                                      deleteReportMutation.mutate(report.id);
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
                        <p className="text-xs text-slate-500 mt-1">Generate a report to see it here</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Pane - AI Report Display */}
              <div className="lg:col-span-2" ref={reportContainerRef}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center flex-wrap gap-2">
                    AI-Generated Executive Report
                    {isStreaming && (
                      <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 text-xs animate-pulse whitespace-nowrap">
                        Generating...
                      </Badge>
                    )}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        if (!aiReport) {
                          toast.error('No report to export. Please generate a report first.');
                          return;
                        }
                        try {
                          // Export ONLY the AI report content
                          const pdfBlob = exportAIReportPDF(aiReport);
                          if (!pdfBlob) {
                            toast.error('Failed to generate PDF');
                            return;
                          }
                          const url = URL.createObjectURL(pdfBlob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `${project.name.replace(/\s+/g, '-')}-ai-executive-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                          toast.success('AI report exported successfully');
                        } catch (error) {
                          console.error('Error exporting PDF:', error);
                          toast.error('Failed to export PDF');
                        }
                      }}
                      disabled={!aiReport}
                      className="border-slate-200 flex-1 sm:flex-none whitespace-nowrap"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export PDF
                    </Button>
                    <Button
                      onClick={generateAIReport}
                      disabled={isGenerating}
                      className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white flex-1 sm:flex-none whitespace-nowrap"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate New Report
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {(aiReport || displayedReport || isGenerating) ? (
                  <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => <h1 className="text-2xl font-bold text-slate-900 mt-6 mb-4 pb-2 border-b-2 border-purple-200">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-xl font-semibold text-slate-900 mt-5 mb-3">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-lg font-semibold text-slate-900 mt-4 mb-2">{children}</h3>,
                          p: ({ children }) => <p className="text-slate-700 mb-3 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc list-outside ml-5 text-slate-700 space-y-1 mb-4">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-outside ml-5 text-slate-700 space-y-1 mb-4">{children}</ol>,
                          li: ({ children }) => <li className="text-slate-700 pl-1">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                          em: ({ children }) => <em className="italic text-slate-600">{children}</em>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-purple-400 pl-4 italic text-slate-700 my-4 bg-white/50 py-2">
                              {children}
                            </blockquote>
                          ),
                        }}
                      >
                        {displayedReport || aiReport || ""}
                      </ReactMarkdown>
                      {isStreaming && (
                        <span className="inline-block w-2 h-4 bg-purple-600 ml-1 animate-pulse">|</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center border-2 border-dashed border-purple-200 rounded-xl bg-purple-50/30">
                    <Sparkles className="h-16 w-16 mx-auto mb-4 text-purple-300" />
                    <h4 className="font-semibold text-slate-900 mb-2">AI-Powered Executive Report</h4>
                    <p className="text-slate-600 mb-4">
                      {selectedReport ? 'Select a report from the list to view it here' : 'Generate a comprehensive report with insights, recommendations, and strategic analysis'}
                    </p>
                    {!selectedReport && (
                      <p className="text-sm text-slate-500">
                        Includes: Executive Summary • Key Achievements • Bottlenecks • Risk Assessment • Team Performance • Strategic Recommendations
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}