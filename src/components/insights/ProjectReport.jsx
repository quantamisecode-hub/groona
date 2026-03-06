import React, { useState, useRef, useMemo, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
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
  Trash2,
  Image as ImageIcon
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import ReactMarkdown from 'react-markdown';
import { toast } from "sonner";

export default function ProjectReport({ project, tasks, stories = [], activities }) {
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
  const scrollAnchorRef = useRef(null);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);

  // Fetch user profiles to map emails to names and titles
  const { data: userProfiles = [] } = useQuery({
    queryKey: ['user-profiles'],
    queryFn: () => groonabackend.entities.UserProfile.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => groonabackend.entities.Client.list(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => groonabackend.entities.Workspace.list(),
    staleTime: 10 * 60 * 1000,
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

  // Memoized list of names to bold
  const boldTargets = useMemo(() => {
    const names = new Set();
    if (project?.name) names.add(project.name);
    // Add client and workspace names if available
    if (project.client_id) {
      const client = clients.find(c => c.id === project.client_id);
      if (client?.name) names.add(client.name);
    }
    if (project.workspace_id) {
      const workspace = workspaces.find(w => w.id === project.workspace_id);
      if (workspace?.name) names.add(workspace.name);
    }
    tasks.forEach(t => { if (t.title) names.add(t.title); });
    userProfiles.forEach(p => {
      if (p.full_name) names.add(p.full_name);
      if (p.name) names.add(p.name);
    });
    return Array.from(names).filter(n => n && n.length > 2).sort((a, b) => b.length - a.length); // Longest first, ignore very short names
  }, [project, tasks, userProfiles, clients, workspaces]);

  // Preprocess markdown to bold identifiers and quotes
  const preprocessMarkdown = (text) => {
    if (!text) return "";
    let processed = text;

    // 1. Bold explicit targets (projects, tasks, and team members)
    boldTargets.forEach(name => {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Use case-insensitive regex ('gi') and negative lookbehind/lookahead to avoid double-bolding
      const regex = new RegExp(`(?<!\\*\\*)\\b${escapedName}\\b(?!\\*\\*)`, 'gi');
      processed = processed.replace(regex, (match) => `**${match}**`);
    });

    // 2. Bold dates, percentages, and critical figures
    const boldPatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/gi,
      /\b\d{4}-\d{2}-\d{2}\b/g,
      /\b\d+(\.\d+)?%\b/g, // Percentages
      /(?<!\d)(?:\$|₹|£|€|USD)\s?\d+(?:,\d+)*(?:\.\d+)?(?:[kMBb])?\b/gi, // Currency/Figures
    ];
    boldPatterns.forEach(pattern => {
      processed = processed.replace(pattern, (match) => `**${match}**`);
    });

    // 3. Bold double quotes (ensure we don't double bold if already bolded inside quotes)
    processed = processed.replace(/"(.*?)"/g, (match, p1) => `**"${p1}"**`);

    return processed;
  };

  // Scroll detection to pause auto-scroll if user scrolls up
  useEffect(() => {
    const handleScroll = () => {
      if (!isStreaming) return;

      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // If user is more than 150px from the bottom, they've scrolled up
      if (documentHeight - (scrollY + windowHeight) > 150) {
        if (!userHasScrolledUp) setUserHasScrolledUp(true);
      } else {
        if (userHasScrolledUp) setUserHasScrolledUp(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isStreaming, userHasScrolledUp]);

  // Fetch reports logic follows...

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

    // Calculate completion rate using Story Points (strict formula: Done SP / Total SP)
    const completedStoryPoints = stories
      .filter(s => {
        const status = (s.status || '').toLowerCase();
        return status === 'done' || status === 'completed';
      })
      .reduce((sum, story) => sum + (Number(story.story_points) || 0), 0);

    const totalStoryPoints = stories.reduce((sum, story) => sum + (Number(story.story_points) || 0), 0);
    const completionRate = totalStoryPoints === 0 ? 0 : Math.round((completedStoryPoints / totalStoryPoints) * 100);

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
      completionRate,
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

  // Typewriter effect function - balanced speed (middle ground)
  const typewriterEffect = (text, speed = 10) => {
    return new Promise((resolve) => {
      let index = 0;
      setDisplayedReport("");
      setIsStreaming(true);

      const type = () => {
        if (index < text.length) {
          // Balanced step size (10-15 chars) for a smooth but efficient reveal
          const nextIndex = Math.min(index + 12, text.length);
          setDisplayedReport(text.substring(0, nextIndex));
          index = nextIndex;

          // Auto-scroll to bottom while typing if user hasn't scrolled up manually
          if (index % 60 === 0 && !userHasScrolledUp) {
            scrollAnchorRef.current?.scrollIntoView({
              behavior: 'auto',
              block: 'end'
            });
          }

          setTimeout(type, speed);
        } else {
          setIsStreaming(false);
          // Final scroll if not manually scrolled up
          if (!userHasScrolledUp) {
            scrollAnchorRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'end'
            });
          }
          resolve();
        }
      };

      type();
    });
  };

  // Auto-scroll effect when report changes or while streaming
  useEffect(() => {
    if ((displayedReport || aiReport) && isStreaming && !userHasScrolledUp) {
      scrollAnchorRef.current?.scrollIntoView({
        behavior: 'auto',
        block: 'end'
      });
    }
  }, [displayedReport, aiReport, isStreaming, userHasScrolledUp]);

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

      const overdueTasksContext = analytics.overdueTasks.slice(0, 5).map(t => `- **${t.title}** (Due: ${format(new Date(t.due_date), 'MMM d, yyyy')})`).join('\n');
      const urgentTasksContext = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').slice(0, 5).map(t => `- **${t.title}** (Priority: Urgent)`).join('\n');

      const prompt = `Generate a comprehensive, strategic executive project report for the following project:

PROJECT CONTEXT:
- Project Name: ${project.name}
- Client: ${clients.find(c => c.id === project.client_id)?.name || 'N/A'}
- Workspace: ${workspaces.find(w => w.id === project.workspace_id)?.name || 'Default'}
- Description: ${project.description || 'No description'}
- Status: ${project.status}
- Overall Progress: ${analytics.completionRate}%
- Deadline: ${project.deadline ? format(new Date(project.deadline), 'MMM d, yyyy') : 'Not set'}
- Priority: ${project.priority || 'Medium'}
- Billing Model: ${project.billing_model || 'N/A'}
- Budget/Contract: ${project.currency || '$'}${Number(project.contract_amount || project.budget || 0).toLocaleString()}

DETAILED STATISTICS:
- Total Tasks: ${tasks.length}
- Completed: ${analytics.completedTasks.length} (${analytics.completionRate}%)
- In Progress: ${analytics.tasksByStatus.in_progress}
- In Review/Feedback: ${analytics.tasksByStatus.review}
- Pending/Backlog: ${analytics.tasksByStatus.todo}
- OVERDUE TASKS: ${analytics.overdueTasks.length}
- Velocity: ${velocity} tasks/day
- Team Resources: ${analytics.assignedUsers.length} members

CRITICAL ISSUES:
${overdueTasksContext || '- No overdue tasks'}
${urgentTasksContext || '- No other urgent tasks'}

RECENT PROJECT TRAJECTORY:
${analytics.recentActivities.slice(0, 8).map(a => `- ${a.user_name} ${a.action} ${a.entity_type}: ${a.entity_name} (${format(new Date(a.created_date), 'MMM d')})`).join('\n')}

INSTRUCTIONS:
Analyze the data above and provide a COMPREHENSIVE strategic report. Do NOT be overly concise; provide professional depth and actionable insights.

The report MUST include these specific sections:
1. # Executive Summary (High-level overview of project health and trajectory)
2. ## Key Achievements (Major milestones reached and velocity highlights)
3. ## Current Bottlenecks (Analytical look at what's slowing progress, citing specific tasks if relevant)
4. ## Risk Assessment (Detailed analysis of overdue items, deadlines, and potential blockers)
5. ## Team Performance (Assessment of team engagement and task completion trends)
6. ## Strategic Recommendations (Professional advice for project success and timeline optimization)

FORMATTING RULES:
- Use **bold text** to highlight:
    - Team member names
    - Specific Task Titles
    - Due Dates
    - Critical Figures (percentages, counts, currency)
    - Phase names or Key strategic terms
- Use clear headers and bullet points for readability.
- Maintain a professional, executive tone.`;

      const result = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false,
      });

      setAiReport(result);

      // Start typewriter effect - balanced speed
      await typewriterEffect(result, 10);

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
      await typewriterEffect(errorMessage, 10);
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

  // Helper function to check if text contains dates or bold targets for PDF bolding
  const shouldBoldPDFLine = (text) => {
    if (!text) return false;
    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/i,
      /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/i,
      /\b\d{4}-\d{2}-\d{2}\b/,
      /\b\d+(\.\d+)?%\b/, // Percentages
      /(?:\$|₹|£|€|USD)\s?\d+/, // Currency/Figures
    ];
    if (datePatterns.some(pattern => pattern.test(text))) return true;

    // Check for bold targets in the line
    return boldTargets.some(name => {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedName}\\b`, 'i');
      return regex.test(text);
    });
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
              if (shouldBoldPDFLine(line)) {
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
            if (shouldBoldPDFLine(line)) {
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

      const lineShouldBeBold = shouldBeBold || shouldBoldPDFLine(line);

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

    const content = aiReportContent || "";
    const lines = content.split('\n');
    const bulletIndent = 3;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if we're running out of space
      if (yPos > pageHeight - margin - 15) {
        doc.addPage();
        yPos = margin + 10;
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
    <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm p-4 sm:p-6 lg:p-8 relative overflow-hidden transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 rounded-[18px] border border-slate-200/60 shadow-sm">
            <AvatarImage src={project.logo_url} />
            <AvatarFallback className="bg-blue-600 text-[12px] text-white font-black">
              {project.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-normal mb-1">
              Project Report
            </h2>
            <p className="text-sm font-bold text-slate-500">{project.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={scheduleReport}
            disabled={isScheduling}
            className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl px-4 shadow-sm"
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
            size="sm"
            onClick={downloadReport}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 shadow-sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      <div className="space-y-8" ref={reportRef}>
        <div>
          {/* Overview */}
          <div className="p-6 md:p-8 rounded-[32px] bg-slate-50/50 border border-slate-200/60 shadow-sm relative overflow-hidden group">

            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Project Overview</h3>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-8">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <p className="font-black text-slate-900 text-sm uppercase tracking-wider">{project.status?.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Progress</p>
                <p className="text-2xl font-black text-slate-900 tracking-normal leading-none">{analytics.completionRate}%</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Priority</p>
                <p className="font-black text-slate-900 text-sm uppercase tracking-wider">{project.priority || 'medium'}</p>
              </div>

              {project.client_id && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Client</p>
                  <p className="font-black text-slate-900 text-sm tracking-normal">
                    {clients.find(c => c.id === project.client_id)?.name || 'Unknown'}
                  </p>
                </div>
              )}

              {project.workspace_id && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Workspace</p>
                  <p className="font-black text-slate-900 text-sm tracking-normal">
                    {workspaces.find(w => w.id === project.workspace_id)?.name || 'Default'}
                  </p>
                </div>
              )}

              {project.billing_model && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Billing Model</p>
                  <p className="font-black text-slate-900 text-sm capitalize tracking-normal">
                    {project.billing_model.replace('_', ' ')}
                  </p>
                </div>
              )}

              {(project.contract_amount || project.budget) && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Budget / Contract</p>
                  <p className="font-black text-emerald-600 text-sm tracking-normal">
                    {project.currency || '$'}{Number(project.contract_amount || project.budget).toLocaleString()}
                  </p>
                </div>
              )}

              {project.deadline && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Deadline</p>
                  <p className="font-black text-slate-900 text-sm tracking-normal">
                    {format(new Date(project.deadline), 'MMM d, yyyy')}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Created</p>
                <p className="font-black text-slate-600 text-sm tracking-normal">
                  {format(new Date(project.created_date), 'MMM d, yyyy')}
                </p>
              </div>
            </div>

            {project.description && (
              <div className="mt-10 pt-6 border-t border-slate-200/60">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Project Description</p>
                <div className="text-slate-700 text-sm font-medium leading-relaxed max-w-4xl">
                  <ReactMarkdown>{project.description}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Key Metrics */}
          <div>
            <h3 className="text-base font-black text-slate-900 mt-8 mb-4 tracking-normal">Key Metrics</h3>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-green-50/50 border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">Completed</p>
                </div>
                <p className="text-3xl font-black text-green-600 tracking-normal">{analytics.completedTasks.length}</p>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">In Progress</p>
                </div>
                <p className="text-3xl font-black text-blue-600 tracking-normal">{analytics.tasksByStatus.in_progress}</p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-amber-600" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">Pending</p>
                </div>
                <p className="text-3xl font-black text-amber-500 tracking-normal">{analytics.tasksByStatus.todo}</p>
              </div>

              <div className="p-4 rounded-2xl bg-red-50/50 border border-red-200">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">Overdue</p>
                </div>
                <p className="text-3xl font-black text-red-600 tracking-normal">{analytics.overdueTasks.length}</p>
              </div>
            </div>
          </div>

          {/* Team Information */}
          <div>
            <h3 className="text-base font-black text-slate-900 mt-8 mb-4 tracking-normal">Team</h3>
            <div className="p-5 sm:p-6 rounded-[32px] bg-slate-50/50 border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <Users className="h-5 w-5 text-slate-600" />
                <p className="font-black text-slate-900 text-sm tracking-normal">
                  {analytics.assignedUsers.length} Team Member{analytics.assignedUsers.length !== 1 ? 's' : ''} Assigned
                </p>
              </div>
              {analytics.assignedUsers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {analytics.assignedUsers.map((email, index) => {
                    const profile = userMap[email];
                    return (
                      <Badge key={index} variant="outline" className="bg-white px-3 py-1.5 shadow-sm border-slate-200 rounded-lg">
                        {profile ? (
                          <span className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 tracking-normal">{profile.name}</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-500 text-[10px] uppercase font-black tracking-widest leading-none">{profile.title}</span>
                          </span>
                        ) : email}
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No tasks assigned yet</p>
              )}
            </div>
          </div>

          {/* Reports List Pane and AI Report Section */}
          <div className="border-t border-slate-100 pt-8 mt-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Pane - Reports List */}
              <div className="lg:col-span-1">
                <div className="sticky top-4">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <History className="h-4 w-4" strokeWidth={2.5} />
                      </div>
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Report History</h3>
                    </div>
                    <Badge className="bg-slate-100 text-slate-600 font-bold text-[10px] px-2 shadow-none border-none">
                      {previousReports.length}
                    </Badge>
                  </div>
                  <div className="max-h-[300px] lg:max-h-[600px] overflow-y-auto pr-2 scrollbar-hide">
                    {previousReports.length > 0 ? (
                      <div className="space-y-3">
                        {previousReports.map((report) => (
                          <div
                            key={report.id}
                            onClick={() => {
                              setSelectedReport(report);
                              setAiReport(report.report_content);
                              setDisplayedReport(report.report_content);
                            }}
                            className={`p-4 rounded-[20px] border cursor-pointer transition-all ${selectedReport?.id === report.id
                              ? 'bg-[#F9FAFB] border-slate-300 shadow-sm ring-1 ring-slate-200'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                              }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <FileText className={`h-4 w-4 flex-shrink-0 ${selectedReport?.id === report.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                                  <p className="text-sm font-bold text-slate-900 truncate tracking-normal">
                                    {report.project_name}
                                  </p>
                                </div>
                                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider space-y-1">
                                  <p className="truncate">
                                    By: {report.generated_by_name || report.generated_by}
                                  </p>
                                  <p>{format(new Date(report.created_date), 'MMM d, pyyy HH:mm')}</p>
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
                      <div className="text-center py-12 px-4 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/50">
                        <FileText className="h-8 w-8 mx-auto mb-3 text-slate-300" />
                        <p className="text-sm font-bold text-slate-900 tracking-normal">No reports yet</p>
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-1">Generate a report</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Pane - AI Report Display */}
              <div className="lg:col-span-2" ref={reportContainerRef}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 flex items-center flex-wrap gap-2 tracking-normal">
                    AI-Generated Executive Report
                    {isStreaming && (
                      <Badge className="bg-blue-100 text-blue-700 font-bold text-[10px] uppercase tracking-widest px-2 animate-pulse whitespace-nowrap border-none shadow-none ml-2">
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
                      className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none whitespace-nowrap rounded-xl shadow-sm border border-blue-600"
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
                  <div className="p-6 md:p-10 rounded-[32px] bg-white border border-slate-200 shadow-sm relative">
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => <h1 className="text-3xl font-black text-slate-900 mt-2 mb-6 tracking-normal">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4 tracking-normal">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mt-8 mb-3">{children}</h3>,
                          p: ({ children }) => <p className="text-slate-600 mb-5 leading-relaxed font-medium">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc list-outside ml-4 text-slate-600 space-y-2 mb-6 font-medium">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-outside ml-4 text-slate-600 space-y-2 mb-6 font-medium">{children}</ol>,
                          li: ({ children }) => <li className="pl-1 text-slate-600 marker:text-slate-400">{children}</li>,
                          strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
                          em: ({ children }) => <em className="italic text-slate-500">{children}</em>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-2 border-slate-300 pl-6 py-2 italic text-slate-600 my-8 bg-slate-50/50 rounded-r-2xl">
                              {children}
                            </blockquote>
                          ),
                        }}
                      >
                        {preprocessMarkdown(displayedReport || aiReport || "")}
                      </ReactMarkdown>
                      {isStreaming && (
                        <span className="inline-block w-2 h-4 bg-blue-600 ml-1 animate-pulse">|</span>
                      )}
                      {/* Precise scroll anchor */}
                      <div ref={scrollAnchorRef} className="h-px w-full" />
                    </div>
                  </div>
                ) : (
                  <div className="p-16 text-center border border-slate-200 rounded-[32px] bg-[#F9FAFB] flex flex-col items-center justify-center min-h-[400px]">
                    <div className="h-16 w-16 mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                      <Sparkles className="h-8 w-8 text-slate-400" />
                    </div>
                    <h4 className="font-black text-slate-900 mb-3 tracking-normal text-xl">AI-Powered Executive Report</h4>
                    <p className="text-sm font-medium text-slate-500 mb-8 max-w-sm mx-auto leading-relaxed">
                      {selectedReport ? 'Select a report from the list to view it here' : 'Generate a comprehensive report with insights, recommendations, and strategic analysis'}
                    </p>
                    {!selectedReport && (
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 max-w-md mx-auto leading-relaxed">
                        Includes: Executive Summary • Key Achievements • Bottlenecks • Risk Assessment • Team Performance • Strategic Recommendations
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}