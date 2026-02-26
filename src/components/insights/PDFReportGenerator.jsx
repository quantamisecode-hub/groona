import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

// Helper: Compress Logo Image to keep PDF small and optimized
const getCompressedLogo = (src, width = 100, quality = 0.8) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = src;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const aspect = img.height / img.width;
            canvas.width = width;
            canvas.height = width * aspect;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve({
                dataUrl: canvas.toDataURL('image/jpeg', quality),
                width: width,
                height: width * aspect,
                ratio: aspect
            });
        };
        img.onerror = () => resolve(null);
    });
};

// ... (Keep existing generateBrandedDocumentPDF code) ...
export const generateBrandedDocumentPDF = async (htmlContent, metadata) => {
    // ... (Keep existing implementation) ...
    const {
        logoUrl,
        companyName,
        title,
        author,
        createdDate,
        category
    } = metadata;

    const doc = new jsPDF();
    const margin = 15;
    let y = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (margin * 2);

    if (logoUrl) {
        try {
            const logo = await getCompressedLogo(logoUrl, 150);
            if (logo) {
                const pdfLogoWidth = 20;
                const pdfLogoHeight = logo.ratio * pdfLogoWidth;
                doc.addImage(logo.dataUrl, 'JPEG', margin, y, pdfLogoWidth, pdfLogoHeight);
            }
        } catch (e) {
            console.warn("Could not add logo to PDF", e);
        }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(50, 50, 50);
    doc.text(companyName || 'Organization', pageWidth - margin, y + 8, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(format(new Date(), 'MMM d, yyyy'), pageWidth - margin, y + 14, { align: 'right' });

    y += 25;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);

    const titleLines = doc.splitTextToSize(title, contentWidth);
    doc.text(titleLines, margin, y);
    y += (titleLines.length * 8);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const metaText = `Author: ${author}  |  Category: ${category || 'General'}  |  Created: ${format(new Date(createdDate || new Date()), 'MMM d, yyyy')}`;
    doc.text(metaText, margin, y);
    y += 15;

    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(htmlContent, 'text/html');
    const nodes = Array.from(htmlDoc.body.childNodes);

    const checkPageBreak = (heightNeeded = 10) => {
        if (y + heightNeeded > 280) {
            doc.addPage();
            y = 20;
            return true;
        }
        return false;
    };

    nodes.forEach((node) => {
        const textContent = node.textContent?.trim();
        if (!textContent && node.nodeName !== 'HR') return;

        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);

        if (node.nodeName === 'H1' || node.nodeName === 'H2') {
            checkPageBreak(15);
            y += 5;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(30, 30, 30);
            const lines = doc.splitTextToSize(textContent, contentWidth);
            doc.text(lines, margin, y);
            y += (lines.length * 7) + 2;
        }
        else if (node.nodeName === 'H3' || node.nodeName === 'H4') {
            checkPageBreak(12);
            y += 3;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(13);
            doc.setTextColor(50, 50, 50);
            const lines = doc.splitTextToSize(textContent, contentWidth);
            doc.text(lines, margin, y);
            y += (lines.length * 6) + 2;
        }
        else if (node.nodeName === 'P' || node.nodeName === 'DIV') {
            checkPageBreak(8);
            doc.setFontSize(11);
            doc.setTextColor(20, 20, 20);
            const lines = doc.splitTextToSize(textContent, contentWidth);
            doc.text(lines, margin, y);
            y += (lines.length * 5) + 3;
        }
        else if (node.nodeName === 'UL' || node.nodeName === 'OL') {
            const items = Array.from(node.children);
            items.forEach((li, i) => {
                const liText = li.textContent.trim();
                if (!liText) return;

                checkPageBreak(8);
                doc.setFontSize(11);

                const bullet = node.nodeName === 'OL' ? `${i + 1}.` : '•';
                const indent = 8;

                doc.text(bullet, margin + 2, y);

                const lines = doc.splitTextToSize(liText, contentWidth - indent);
                doc.text(lines, margin + indent, y);
                y += (lines.length * 5) + 2;
            });
            y += 2;
        }
        else if (node.nodeName === 'BLOCKQUOTE') {
            checkPageBreak(10);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(80, 80, 80);
            const lines = doc.splitTextToSize(textContent, contentWidth - 10);
            const height = (lines.length * 5);
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(1);
            doc.line(margin, y, margin, y + height);
            doc.text(lines, margin + 5, y + 4);
            y += height + 8;
        }
    });

    return doc.output('blob');
};

// ... (Keep existing generateTimesheetReportPDF code) ...
export const generateTimesheetReportPDF = (timesheets, filters) => {
    // ... (Keep existing implementation) ...
    const doc = new jsPDF();
    const margin = 15;
    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (margin * 2);

    const checkPageBreak = (spaceNeeded = 10) => {
        if (y + spaceNeeded > 280) {
            doc.addPage();
            y = 20;
            return true;
        }
        return false;
    };

    const drawTableHeader = () => {
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y, contentWidth, 8, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        let x = margin + 2;
        doc.text("Date", x, y + 5); x += 25;
        doc.text("Project", x, y + 5); x += 40;
        doc.text("User", x, y + 5); x += 35;
        doc.text("Task", x, y + 5); x += 45;
        doc.text("Hours", x, y + 5); x += 15;
        doc.text("Status", x, y + 5);
        y += 10;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229);
    doc.text("Timesheet Report", margin, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, margin, y);
    y += 6;
    doc.text(`Period: ${filters.date_range_start} to ${filters.date_range_end}`, margin, y);
    y += 10;

    const totalHours = timesheets.reduce((acc, t) => acc + (t.total_minutes || 0), 0) / 60;
    const billableHours = timesheets.filter(t => t.is_billable).reduce((acc, t) => acc + (t.total_minutes || 0), 0) / 60;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text(`Total Records: ${timesheets.length}`, margin, y);
    doc.text(`Total Hours: ${totalHours.toFixed(2)}`, margin + 60, y);
    doc.text(`Billable Hours: ${billableHours.toFixed(2)}`, margin + 120, y);
    y += 12;

    drawTableHeader();

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    timesheets.forEach((t, index) => {
        if (checkPageBreak()) {
            drawTableHeader();
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
        }

        const date = t.date ? format(new Date(t.date), 'MMM d, yyyy') : '-';
        const project = t.project_name || '-';
        const user = t.user_name || t.user_email || '-';
        const task = t.task_title || '-';
        const hours = ((t.total_minutes || 0) / 60).toFixed(2);
        const status = t.status || 'Pending';

        const truncate = (str, len) => str && str.length > len ? str.substring(0, len) + '...' : str || '-';

        let x = margin + 2;
        doc.text(date, x, y); x += 25;
        doc.text(truncate(project, 22), x, y); x += 40;
        doc.text(truncate(user, 20), x, y); x += 35;
        doc.text(truncate(task, 25), x, y); x += 45;
        doc.text(hours, x, y); x += 15;

        if (status === 'approved') doc.setTextColor(22, 163, 74);
        else if (status === 'rejected') doc.setTextColor(220, 38, 38);
        else doc.setTextColor(202, 138, 4);

        doc.text(status.charAt(0).toUpperCase() + status.slice(1), x, y);
        doc.setTextColor(0, 0, 0);

        y += 7;
        if ((index + 1) % 5 === 0) {
            doc.setDrawColor(240, 240, 240);
            doc.line(margin, y - 4, pageWidth - margin, y - 4);
        }
    });

    return doc.output('blob');
};

// ... (Keep existing generateProjectReportPDF code) ...
export const generateProjectReportPDF = (project, analytics, aiReport, userMap = {}) => {
    // ... (Keep existing implementation) ...
    const doc = new jsPDF();
    const margin = 20;
    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (margin * 2);

    const checkPageBreak = (spaceNeeded = 10) => {
        if (y + spaceNeeded > 280) {
            doc.addPage();
            y = 20;
        }
    };

    const addTitle = (text) => {
        checkPageBreak(15);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(33, 33, 33);
        doc.text(text, margin, y);
        y += 2;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;
    };

    const addField = (label, value, xOffset = 0, isInline = false) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`${label}:`, margin + xOffset, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        const valStr = value !== undefined && value !== null ? String(value) : "N/A";
        doc.text(valStr, margin + xOffset + 35, y);
        if (!isInline) y += 6;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229);
    doc.text("Project Summary Report", margin, y);
    y += 10;
    doc.setFontSize(16);
    doc.setTextColor(50, 50, 50);
    doc.text(project.name, margin, y);
    y += 15;

    addTitle("Project Overview");
    addField("Status", project.status?.toUpperCase());
    addField("Progress", `${project.progress || 0}%`);
    if (project.deadline) {
        addField("Deadline", format(new Date(project.deadline), 'MMM d, yyyy'));
    }
    addField("Created", format(new Date(project.created_date), 'MMM d, yyyy'));
    y += 5;

    addTitle("Key Metrics");

    addField("Completed", analytics.completedTasks.length, 0, true);
    addField("In Progress", analytics.tasksByStatus.in_progress, 80, true);
    y += 8;

    addField("Pending", analytics.tasksByStatus.todo, 0, true);
    addField("Overdue", analytics.overdueTasks.length, 80, true);
    y += 12;

    addTitle("Team Members");
    if (analytics.assignedUsers.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const teamNames = analytics.assignedUsers.map(email => {
            const profile = userMap[email];
            return profile ? `${profile.name} (${profile.title})` : email;
        }).join(", ");
        const splitTeam = doc.splitTextToSize(teamNames, contentWidth);
        checkPageBreak(splitTeam.length * 5);
        doc.text(splitTeam, margin, y);
        y += (splitTeam.length * 5) + 5;
    } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("No team members assigned.", margin, y);
        y += 10;
    }

    addTitle("Recent Activity");
    if (analytics.recentActivities.length > 0) {
        doc.setFontSize(9);
        analytics.recentActivities.slice(0, 8).forEach(activity => {
            checkPageBreak(12);
            const dateStr = format(new Date(activity.created_date), 'MMM d, HH:mm');
            doc.setFont("helvetica", "bold");
            doc.setTextColor(50, 50, 50);
            doc.text(`•  ${activity.user_name} ${activity.action} ${activity.entity_type}`, margin, y);
            y += 4;
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 100, 100);
            const detail = activity.entity_name || "";
            const truncatedDetail = detail.length > 90 ? detail.substring(0, 90) + "..." : detail;
            doc.text(`   ${truncatedDetail} - ${dateStr}`, margin, y);
            y += 6;
        });
        y += 5;
    } else {
        doc.text("No recent activity.", margin, y);
        y += 10;
    }

    if (aiReport) {
        doc.addPage();
        y = 20;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(79, 70, 229);
        doc.text("AI Executive Summary", margin, y);
        y += 15;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);

        const cleanReport = aiReport
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/__(.*?)__/g, "$1")
            .replace(/###\s?/g, "")
            .replace(/##\s?/g, "")
            .replace(/#\s?/g, "")
            .replace(/^\s*-\s/gm, "•  ");

        const shouldBoldPDFLine = (text) => {
            if (!text) return false;
            const datePatterns = [
                /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
                /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/i,
                /\b\d{4}-\d{2}-\d{2}\b/,
            ];
            if (datePatterns.some(pattern => pattern.test(text))) return true;

            if (project.name && new RegExp(`\\b${project.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) return true;

            for (const email in userMap) {
                const name = typeof userMap[email] === 'object' ? userMap[email].name : userMap[email];
                if (name && typeof name === 'string' && name.length > 2) {
                    if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) return true;
                }
            }
            return false;
        };

        const splitReport = doc.splitTextToSize(cleanReport, contentWidth);

        splitReport.forEach(line => {
            checkPageBreak(5);

            const trimmed = line.trim();
            const isHeader = trimmed.length > 0 && trimmed.length < 60 && (trimmed.endsWith(':') || /^[A-Z\s]+$/.test(trimmed));

            if (isHeader || shouldBoldPDFLine(line)) {
                y += 2;
                doc.setFont("helvetica", "bold");
                doc.text(line, margin, y);
                doc.setFont("helvetica", "normal");
            } else {
                doc.text(line, margin, y);
            }
            y += 5;
        });
    }

    return doc.output('blob');
};

// --- NEW: Sprint Report Generator ---
export const generateSprintReportPDF = (sprint, tasks, project) => {
    const doc = new jsPDF();
    const margin = 20;
    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (margin * 2);

    const checkPageBreak = (spaceNeeded = 10) => {
        if (y + spaceNeeded > 280) {
            doc.addPage();
            y = 20;
            return true;
        }
        return false;
    };

    // 1. Header Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229);
    doc.text("Sprint Report", margin, y);
    y += 10;

    doc.setFontSize(16);
    doc.setTextColor(50, 50, 50);
    doc.text(sprint.name || "Unnamed Sprint", margin, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Project: ${project?.name || 'Unknown'}`, margin, y);
    y += 6;
    if (sprint.start_date && sprint.end_date) {
        const start = format(new Date(sprint.start_date), 'MMM d');
        const end = format(new Date(sprint.end_date), 'MMM d, yyyy');
        doc.text(`Duration: ${start} - ${end}`, margin, y);
        y += 6;
    }
    doc.text(`Generated on: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, margin, y);
    y += 12;

    // 2. Statistics Summary
    const todoTasks = tasks.filter(t => t.status === 'todo');
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const reviewTasks = tasks.filter(t => t.status === 'review');
    const doneTasks = tasks.filter(t => t.status === 'completed');

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    const drawStat = (label, value, x) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(50, 50, 50);
        doc.text(String(value), x, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(120, 120, 120);
        doc.text(label, x, y + 6);
    };

    drawStat("Total Tasks", tasks.length, margin);
    drawStat("To Do", todoTasks.length, margin + 40);
    drawStat("In Progress", inProgressTasks.length, margin + 80);
    drawStat("Completed", doneTasks.length, margin + 120);
    y += 20;

    doc.line(margin, y, pageWidth - margin, y);
    y += 15;

    // 3. Task List by Status
    const renderTaskGroup = (title, groupTasks, color) => {
        if (groupTasks.length === 0) return;

        checkPageBreak(20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(`${title} (${groupTasks.length})`, margin, y);
        y += 8;

        groupTasks.forEach(task => {
            checkPageBreak(15);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(50, 50, 50);

            // Task Title
            const titleText = `•  ${task.title}`;
            doc.text(titleText, margin, y);

            // Metadata (Assignee, Priority)
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);

            const assignee = task.assigned_to_name || task.assigned_to || 'Unassigned';
            const priority = task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Normal';

            const meta = `   Assignee: ${assignee}  |  Priority: ${priority}`;
            doc.text(meta, margin, y + 5);

            y += 12;
        });
        y += 5;
    };

    renderTaskGroup("Completed", doneTasks, [22, 163, 74]); // Green
    renderTaskGroup("In Progress", inProgressTasks, [37, 99, 235]); // Blue
    renderTaskGroup("Review", reviewTasks, [234, 179, 8]); // Amber
    renderTaskGroup("To Do", todoTasks, [107, 114, 128]); // Gray

    return doc.output('blob');
};

// ... (Keep existing generatePdfFromHtml code if needed for other parts, or remove if unused) ...
export const generatePdfFromHtml = async (element, filename = 'report') => {
    // ... (Keep existing implementation) ...
    if (!element) return null;
    try {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);
        const ratio = pdfWidth / imgProps.width;
        const scaledHeight = imgProps.height * ratio;
        let heightLeft = scaledHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledHeight);
        heightLeft -= pdfHeight;
        while (heightLeft >= 0) {
            position = heightLeft - scaledHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledHeight);
            heightLeft -= pdfHeight;
        }
        return pdf.output('blob');
    } catch (error) {
        console.error("Error generating PDF:", error);
        throw error;
    }
};
