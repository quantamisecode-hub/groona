/* eslint-disable react/prop-types */
import { useState, useMemo, useRef, useEffect } from "react";
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

const adminQuestions = [
  "What are the biggest risks across all my projects?",
  "Which projects need immediate attention?",
  "How can I improve team productivity?",
  "What tasks are blocking progress?",
  "Predict completion dates for all active projects",
  "Which team members are overloaded?",
  "What's the overall health of my projects?",
  "Give me recommendations to speed up delivery",
];

const viewerQuestions = [
  "What should I focus on today?",
  "What tasks are high priority?",
  "Which of my tasks are at risk?",
  "Do I have any overdue tasks?",
  "What is blocking my progress?",
  "Am I overloaded this sprint?",
  "How is my performance this week?",
  "What should I complete next?",
];

const pmQuestions = [
  "What projects need immediate attention?",
  "Which milestones are at risk?",
  "Are we on track this sprint?",
  "Where are the delivery bottlenecks?",
  "Which team members are overloaded?",
  "What tasks are blocking progress?",
  "Predict completion dates for active projects.",
  "Give recommendations to improve delivery speed.",
];

export default function AskAIInsights({ projects, tasks }) {
  const { user: currentUser, effectiveTenantId } = useUser();
  const isRestrictedViewer = currentUser && !currentUser.is_super_admin && currentUser.role === 'member' && currentUser.custom_role === 'viewer';
  const isProjectManager = currentUser && !currentUser.is_super_admin && currentUser.role === 'admin' && currentUser.custom_role === 'project_manager';
  const isOwner = currentUser && !currentUser.is_super_admin && currentUser.role === 'admin' && currentUser.custom_role === 'owner';

  const shouldFilterByMe = isRestrictedViewer || isProjectManager || isOwner;

  const suggestedQuestions = isRestrictedViewer ? viewerQuestions : (isProjectManager ? pmQuestions : adminQuestions);

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
  const scrollAnchorRef = useRef(null);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);

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

  // Memoized list of names to bold
  const boldTargets = useMemo(() => {
    const names = new Set();
    projects.forEach(p => { if (p.name) names.add(p.name); });
    tasks.forEach(t => { if (t.title) names.add(t.title); });
    allUsers.forEach(u => {
      if (u.full_name) names.add(u.full_name);
      if (u.name) names.add(u.name);
      if (u.username) names.add(u.username);
    });
    return Array.from(names).filter(n => n && n.trim().length > 1).sort((a, b) => b.length - a.length); // Longest first, ignore very short single character names
  }, [projects, tasks, allUsers]);

  // Preprocess markdown to bold identifiers and quotes
  const preprocessMarkdown = (text) => {
    if (!text) return "";
    let processed = typeof text === 'string' ? text : JSON.stringify(text);

    // 1. Bold explicit targets (projects, tasks, and team members)
    boldTargets.forEach(name => {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Use case-insensitive regex ('gi') and negative lookbehind/lookahead to avoid double-bolding
      const regex = new RegExp(`(?<!\\*\\*)\\b${escapedName}\\b(?!\\*\\*)`, 'gi');
      processed = processed.replace(regex, (match) => `**${match}**`);
    });

    // 2. Bold dates
    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/gi,
      /\b\d{4}-\d{2}-\d{2}\b/g
    ];
    datePatterns.forEach(pattern => {
      processed = processed.replace(pattern, (match) => `**${match}**`);
    });

    // 3. Remove double quotes around any project/task/team names and ensure strictly bold
    processed = processed.replace(/"(.*?)"/g, '$1');

    // 4. Bold specialized roles
    const rolePatterns = [/\bProject Managers?\b/gi];
    rolePatterns.forEach(pattern => {
      processed = processed.replace(pattern, (match) => `**${match}**`);
    });

    // 5. Clean up "floating bullets" (ensure text is on the same line as bullet)
    // Fixes cases where LLM puts a newline after the bullet marker or multiple newlines
    processed = processed.replace(/^([-*+])\s*\n+/gm, '$1 ');
    processed = processed.replace(/\n\n([-*+])\s*/g, '\n$1 ');

    // 5. Bold counts of tasks, projects, etc. (e.g., "11 overdue tasks", "4 active projects", "0%")
    const countPatterns = [
      /(?<!\*\*)\b(\d+)\s+(?:overdue\s+)?(tasks?|projects?|active projects?|team members?|issues?|risks?|members?|users?)\b(?!\*\*)/gi,
      /(?<!\*\*)\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:overdue\s+)?(tasks?|projects?|active projects?|team members?|issues?|risks?|members?|users?)\b(?!\*\*)/gi,
      /(?<!\*\*)\b\d+(?:\.\d+)?%(?!\*\*)/g // Percentages
    ];
    countPatterns.forEach(pattern => {
      processed = processed.replace(pattern, (match) => `**${match}**`);
    });

    // 6. Ensure common AI headers are bolded, NOT bullets, and on a separate line
    const commonHeaders = [
      "Direct Data Points:\\*",
      "Critical Risks:\\*",
      "Immediate Next Steps:\\*",
      "Strategic Analysis:",
      "Executive Summary:",
      "Recommendations:"
    ];

    commonHeaders.forEach(header => {
      // Ensure the header is bold, on its own line, and has no bullet marker
      // Regex matches the header even if it's inside a line or has a bullet marker
      const regex = new RegExp(`\\n?.*?\\*\\*?(${header})\\*\\*?.*?\\n?|\\n?.*?(${header}).*?\\n?`, 'gi');

      processed = processed.replace(regex, (match, g1, g2) => {
        const foundHeader = g1 || g2;
        // Check if we already have the bold version on a separate line to avoid infinite loop or double work
        return `\n\n**${foundHeader}**\n`;
      });
    });

    // Clean up excessive newlines caused by the replacement
    processed = processed.replace(/\n{3,}/g, '\n\n');

    // 7. Bold Yes/No at the start of sentences for clear confirmation
    processed = processed.replace(/^(Yes|No),/gm, '**$1**,');
    processed = processed.replace(/\. (Yes|No),/g, '. **$1**,');

    // 8. Bold task statuses and clean up "in_progress"
    const statusPatterns = [
      /\b(todo|in[ _]progress|review|done|completed|doing)\b/gi
    ];
    statusPatterns.forEach(pattern => {
      processed = processed.replace(pattern, (match) => {
        let cleanMatch = match.replace(/_/g, ' ').toLowerCase();
        // Use a simple bold instead of backticks
        return `**${cleanMatch}**`;
      });
    });

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
  const { data: previousReports = [], refetch: refetchReports } = useQuery({
    queryKey: ['ai-insights-reports', effectiveTenantId, shouldFilterByMe ? currentUser?.email : 'admin'],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      try {
        const filterParams = { tenant_id: effectiveTenantId };
        if (shouldFilterByMe) {
          filterParams.generated_by = currentUser?.email;
        }
        return await groonabackend.entities.AIInsightsReport.filter(filterParams, '-created_date');
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
  const typewriterEffect = (userInput, speed = 5) => {
    const text = typeof userInput === 'string' ? userInput : JSON.stringify(userInput, null, 2);
    return new Promise((resolve) => {
      let index = 0;
      setDisplayedAnswer("");
      setIsStreaming(true);
      setUserHasScrolledUp(false); // Reset scroll state when starting new typing

      const type = () => {
        if (index < text.length) {
          setDisplayedAnswer(text.substring(0, index + 1));
          index++;

          // Auto-scroll to bottom while typing if user hasn't scrolled up manually
          // Scroll more frequently (every 5 chars) for "word-by-word" feel
          if (index % 5 === 0 && !userHasScrolledUp) {
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

  // Helper function to check if text contains dates or bold targets for PDF bolding
  const shouldBoldPDFLine = (text) => {
    if (!text) return false;
    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/, // Dates like 12/25/2024
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/i, // Date formats like Jan 15, 2024
      /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/i, // Date formats like 15 Jan 2024
      /\b\d{4}-\d{2}-\d{2}\b/, // ISO dates like 2024-01-15
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
      const lineShouldBeBold = shouldBeBold || shouldBoldPDFLine(line);

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
    if ((displayedAnswer || answer) && isStreaming && !userHasScrolledUp) {
      scrollAnchorRef.current?.scrollIntoView({
        behavior: 'auto',
        block: 'end'
      });
    }
  }, [displayedAnswer, answer, isStreaming, userHasScrolledUp]);

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

      const prompt = `You are a Smart Project Management Assistant. Provide ACCURATE, DATA-DRIVEN assistance.

STRICT "STRAIGHT TO THE POINT" RULES:
1. GREETING & DIRECT ANSWER: Start the VERY FIRST line of your response with: "Hi **${currentUser?.full_name || 'there'}**, [A brief, one-sentence direct answer to the user's question]."
2. ADDRESSING: After the greeting line, always address the user as "you" or "your" (e.g., "Your project is at risk", "You have tasks due").
3. NO INTRODUCTIONS: After the greeting line, do not use filler phrases like "Based on the data provided" or "Here is an analysis". Go straight to the section headers.
4. ONLY BULLET POINTS: Use only bullet points for data points under section headers.
5. STYLE: Every bullet point MUST follow this style: "- **Insight/Data Point**".
6. BOLDING: ALWAYS bold every **Project Name**, **Task Title**, **Team Member Name**, and **Date**.
7. NO QUOTES: NEVER use double quotes.
8. DATES: Format dates as "**Jan 15, 2026**".
9. HEADERS: CRITICAL: Section headers MUST be on a NEW LINE, MUST be bolded, and MUST NOT have bullet markers.

PROJECT DATA:
${JSON.stringify(contextData, null, 2)}

QUESTION: ${queryQuestion}

RESPONSE STRUCTURE:
Hi **${currentUser?.full_name || 'there'}**, [Brief direct answer].

**Direct Data Points:**
- [Analytical point 1]
- [Analytical point 2]

**Critical Risks:**
- [Risk 1]
- [Risk 2]

**Immediate Next Steps:**
- [Step 1]
- [Step 2]
(Ensure each bold header starts on its own line with no indentation or bullet. Only the items below them should have bullets.)`;

      const result = await groonabackend.integrations.Core.InvokeLLM({
        prompt: queryQuestion,
        context: prompt,
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

              await groonabackend.entities.AIInsightsReport.create({
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
            toast.error(`Report generated but failed to save: ${errorMessage} `);
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
    <div className="space-y-8">
      {/* Input Area */}
      <div className="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-200/60 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-[14px] bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100/50">
            <Sparkles className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-normal mb-0.5">Ask AI for Insights</h2>
            <p className="text-sm font-semibold text-slate-500">Query your project telemetry naturally</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="relative group">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask me anything about your projects, tasks, risks, timelines, or team performance..."
              rows={4}
              className="resize-none bg-[#F9FAFB] border-slate-200/80 rounded-[20px] focus:ring-0 focus:border-blue-300 placeholder:text-slate-400 font-medium text-slate-700 py-4 px-5 text-base transition-all group-focus-within:bg-white group-focus-within:shadow-sm"
              disabled={isLoading}
            />
            <div className="absolute bottom-3 right-3">
              <Button
                onClick={() => handleAsk()}
                disabled={!question.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm px-5 transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing Data...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Ask AI
                  </>
                )}
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Suggested Questions</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setQuestion(q);
                    handleAsk(q);
                  }}
                  disabled={isLoading}
                  className="text-[13px] font-semibold text-slate-600 bg-white border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 px-4 py-2 rounded-xl transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - AI Answer */}
        <div className="lg:col-span-2" ref={answerContainerRef}>
          {(answer || displayedAnswer || isLoading) && (
            <div className="p-6 md:p-10 rounded-[32px] bg-white border border-slate-200 shadow-sm relative">
              <div className="flex items-center gap-2 mb-6 border-b border-slate-200/60 pb-4">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-black text-slate-900 tracking-normal">AI Insights</h3>
                {currentQuestion && (
                  <Badge variant="outline" className="ml-2 bg-slate-50 text-slate-600 border-slate-200 text-xs font-semibold px-3 py-1 rounded-full shadow-none">
                    {currentQuestion.length > 50 ? currentQuestion.substring(0, 50) + '...' : currentQuestion}
                  </Badge>
                )}
                {isStreaming && (
                  <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-600 border-none shadow-none text-[10px] font-bold uppercase tracking-widest px-2 animate-pulse">
                    Generating...
                  </Badge>
                )}
              </div>
              <div className="prose prose-sm max-w-none" ref={answerRef}>
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
                    code: ({ children }) => <code className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 text-[13px] font-mono">{children}</code>,
                  }}
                >
                  {preprocessMarkdown(displayedAnswer || answer || "")}
                </ReactMarkdown>
                {isStreaming && (
                  <span className="inline-block w-2 h-4 bg-blue-600 ml-1 animate-pulse">|</span>
                )}
                {/* Precise scroll anchor */}
                <div ref={scrollAnchorRef} className="h-px w-full" />
              </div>
            </div>
          )}
          {!answer && (
            <div className="p-16 text-center border border-slate-200 rounded-[32px] bg-[#F9FAFB] flex flex-col items-center justify-center min-h-[400px]">
              <div className="h-16 w-16 mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-slate-400" />
              </div>
              <h4 className="font-black text-slate-900 mb-3 tracking-normal text-xl">AI-Powered Insights</h4>
              <p className="text-sm font-medium text-slate-500 mb-8 max-w-sm mx-auto leading-relaxed">
                Ask a question above to get AI-generated insights about your projects, tasks, and team performance.
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 max-w-md mx-auto leading-relaxed">
                Fast • Context-Aware • Data-Driven
              </p>
            </div>
          )}
        </div>

        {/* Right Column - History */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <History className="h-4 w-4" strokeWidth={2.5} />
                </div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Query History</h3>
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
                      key={report.id || report._id}
                      onClick={() => {
                        setSelectedReport(report);
                        setAnswer(report.report_content);
                        setDisplayedAnswer(report.report_content);
                        setCurrentQuestion(report.question);
                      }}
                      className={`p-4 rounded-[20px] border cursor-pointer transition-all ${(selectedReport?.id === report.id || selectedReport?._id === report._id)
                        ? 'bg-[#F9FAFB] border-slate-300 shadow-sm ring-1 ring-slate-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className={`h-4 w-4 flex-shrink-0 ${(selectedReport?.id === report.id || selectedReport?._id === report._id) ? 'text-blue-600' : 'text-slate-400'}`} />
                            <p className="text-sm font-bold text-slate-900 truncate tracking-normal">
                              {report.question.length > 40 ? report.question.substring(0, 40) + '...' : report.question}
                            </p>
                          </div>
                          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider space-y-1">
                            <p className="truncate">
                              By: {report.generated_by_name || report.generated_by}
                            </p>
                            <p>{format(new Date(report.created_date || report.createdDate), 'MMM d, yyyy HH:mm')}</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadPDF(report);
                            }}
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 flex-shrink-0 transition-colors"
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
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
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50/50 flex-shrink-0 transition-colors"
                            title="Delete report"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 px-4 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/50">
                  <FileText className="h-8 w-8 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm font-bold text-slate-900 tracking-normal">No activity yet</p>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-1">Ask your first question</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
