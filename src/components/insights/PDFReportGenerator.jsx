import { jsPDF } from "jspdf";
import { format } from "date-fns";
import html2canvas from "html2canvas";

/**
 * Professional Agile Reporting Engine
 * Generates a print-ready, professional Sprint Performance PDF.
 */
export const generateSprintReportPDF = async (sprint, tasks, project, aiReport, allUsers = []) => {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (margin * 2);
    let y = margin;

    // --- COLOR PALETTE ---
    const COLORS = {
        PRIMARY: [30, 41, 59],     // Slate 800
        SECONDARY: [71, 85, 105],  // Slate 600
        ACCENT: [79, 70, 229],     // Indigo 600
        HEALTHY: [34, 197, 94],    // Green 500
        RISK: [234, 179, 8],       // Yellow 500
        CRITICAL: [220, 38, 38],   // Red 600
        TEXT: [15, 23, 42],        // Slate 900
        LIGHT_TEXT: [100, 116, 139], // Slate 500
        BG_LIGHT: [248, 250, 252],  // Slate 50
        BORDER: [226, 232, 240]    // Slate 200
    };

    // --- HELPERS ---
    const setH1 = () => { doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...COLORS.PRIMARY); };
    const setH2 = () => { doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...COLORS.PRIMARY); };
    const setH3 = () => { doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...COLORS.ACCENT); }; // Semi-bold placeholder
    const setBody = () => { doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...COLORS.TEXT); };
    const setCaption = () => { doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...COLORS.LIGHT_TEXT); };

    // --- DATA MASKING (MANDATORY) ---
    const maskData = (input) => {
        if (!input) return "Unassigned";
        if (typeof input !== 'string') return String(input);

        // 1. Email Masking: john.doe@gmail.com -> John Doe
        if (typeof input === 'string' && input.includes('@')) {
            const namePart = input.split('@')[0];
            return namePart
                .split(/[._-]/)
                .filter(part => part.length > 0)
                .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                .join(' ');
        }

        // 2. ID Masking: Filter out hex strings or long numeric IDs
        if (/^[0-9a-fA-F]{10,}$/.test(input)) return "ID Restricted";
        if (/^\d{10,}$/.test(input)) return "Reference Restricted";

        return input;
    };

    const addHeaderFooter = () => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 2; i <= pageCount; i++) {
            doc.setPage(i);

            // Header
            setCaption();
            doc.text(`${project.name} | ${sprint.name}`, margin, 15);
            doc.text(format(new Date(), 'MMM dd, yyyy HH:mm'), pageWidth - margin, 15, { align: "right" });
            doc.setDrawColor(...COLORS.BORDER);
            doc.line(margin, 17, pageWidth - margin, 17);

            // Footer
            doc.text("Groona Agile Delivery - Confidential Report", margin, pageHeight - 10);
            doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: "right" });
        }
    };

    const checkPageBreak = (needed) => {
        if (y + needed > pageHeight - margin - 20) {
            doc.addPage();
            y = 25; // Account for header
            return true;
        }
        return false;
    };

    // --- SECTION: COVER PAGE ---
    const renderCoverPage = () => {
        const center = pageWidth / 2;

        y = 50;
        setH1();
        doc.text(project.name.toUpperCase(), center, y, { align: "center" });
        y += 12;

        setH2();
        doc.setTextColor(...COLORS.SECONDARY);
        doc.text(sprint.name, center, y, { align: "center" });
        y += 10;

        setBody();
        const dateRange = `${format(new Date(sprint.start_date), 'MMM dd, yyyy')} - ${format(new Date(sprint.end_date), 'MMM dd, yyyy')}`;
        doc.text(dateRange, center, y, { align: "center" });
        y += 8;
        doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy')}`, center, y, { align: "center" });

        // Health Badge
        y = 120;
        const score = aiReport.cover?.healthScore || 0;
        const category = aiReport.cover?.healthCategory || "Not Rated";
        const badgeColor = aiReport.cover?.badgeColor === 'Red' ? COLORS.CRITICAL : (aiReport.cover?.badgeColor === 'Yellow' ? COLORS.RISK : COLORS.HEALTHY);

        doc.setFillColor(...badgeColor);
        doc.circle(center, y + 20, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(28);
        doc.setFont("helvetica", "bold");
        doc.text(String(score), center, y + 25, { align: "center" });
        doc.setFontSize(10);
        doc.text("SCORE", center, y + 32, { align: "center" });

        y += 60;
        doc.setTextColor(...COLORS.TEXT);
        setH3();
        doc.text(String(category).toUpperCase(), center, y, { align: "center" });

        // Team
        y = pageHeight - 60;
        setCaption();
        doc.text("PROJECT TEAM", center, y, { align: "center" });
        y += 6;
        setBody();
        // Use real project team members instead of potentially dummy data
        const teamMembers = project.team_members?.map(m => {
            const email = typeof m === 'string' ? m : m.email;
            // First check if we have a match in allUsers list from DB
            const userFromDb = allUsers.find(u => u.email?.toLowerCase() === email?.toLowerCase());
            if (userFromDb && (userFromDb.full_name || userFromDb.name)) {
                return userFromDb.full_name || userFromDb.name;
            }

            // Fallback to existing properties
            const name = m.name || m.full_name;
            if (name) return name;
            return email || m.id || "Team Member";
        }) || [];

        const team = teamMembers.length > 0
            ? teamMembers.map(m => maskData(m)).join(" | ")
            : "Team Analysis Unavailable";

        const teamLines = doc.splitTextToSize(team, contentWidth);
        doc.text(teamLines, center, y, { align: "center" });

        doc.addPage();
        y = margin;
    };

    // --- SECTION: EXECUTIVE DASHBOARD ---
    const renderDashboard = () => {
        y = 32; // Offset from header line
        setH1();
        doc.text("Sprint Executive Dashboard", margin, y);
        y += 12;

        // Metric Cards (2x3 Grid)
        const m = aiReport.dashboard?.metrics || {};
        const cardWidth = (contentWidth - 10) / 3;
        const cardHeight = 25;

        const metrics = [
            { label: "Total Tasks", value: m.total },
            { label: "Completed", value: m.completed },
            { label: "Overdue", value: m.overdue },
            { label: "Completion Rate", value: `${m.rate}%` },
            { label: "Velocity (SP)", value: m.velocity },
            { label: "Est. Accuracy", value: `${m.accuracy}%` }
        ];

        metrics.forEach((metric, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const cardX = margin + (col * (cardWidth + 5));
            const cardY = y + (row * (cardHeight + 5));

            doc.setFillColor(...COLORS.BG_LIGHT);
            doc.setDrawColor(...COLORS.BORDER);
            doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'FD');

            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(...COLORS.ACCENT);
            doc.text(String(metric.value), cardX + (cardWidth / 2), cardY + 12, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(...COLORS.SECONDARY);
            doc.text(metric.label, cardX + (cardWidth / 2), cardY + 18, { align: "center" });
        });

        y += (cardHeight * 2) + 20;

        // --- CHARTS (Simulated with Shapes) ---
        setH2();
        doc.text("Performance Charts", margin, y);
        y += 10;

        // 1. Task Status Distribution (Status Bar)
        const renderStatusBar = (x, y, title) => {
            doc.setFontSize(9);
            doc.setTextColor(...COLORS.SECONDARY);
            doc.text(title, x, y - 5);

            const sd = aiReport.dashboard?.statusDistribution || { todo: 10, inProgress: 30, review: 20, done: 40 };
            const total = (sd.todo || 0) + (sd.inProgress || 0) + (sd.review || 0) + (sd.done || 0) || 1;

            const barW = 70;
            const barH = 5;
            const bY = y + 10;

            let currentX = x;
            const drawPart = (val, color) => {
                const w = (val / total) * barW;
                if (w > 0) {
                    doc.setFillColor(...color);
                    doc.rect(currentX, bY, w, barH, 'F');
                    currentX += w;
                }
            };

            drawPart(sd.done, COLORS.HEALTHY);
            drawPart(sd.inProgress + sd.review, COLORS.ACCENT);
            drawPart(sd.todo, COLORS.SECONDARY);

            // Legend
            doc.setFontSize(7);
            doc.setFillColor(...COLORS.HEALTHY); doc.rect(x, bY + 10, 3, 3, 'F');
            doc.text(`Done (${sd.done}) - ${Math.round((sd.done / total) * 100)}%`, x + 5, bY + 12.5);

            doc.setFillColor(...COLORS.ACCENT); doc.rect(x + 40, bY + 10, 3, 3, 'F');
            doc.text(`Progress (${sd.inProgress + sd.review}) - ${Math.round(((sd.inProgress + sd.review) / total) * 100)}%`, x + 45, bY + 12.5);

            doc.setFillColor(...COLORS.SECONDARY); doc.rect(x + 80, bY + 10, 3, 3, 'F');
            doc.text(`To Do (${sd.todo})`, x + 85, bY + 12.5);
        };

        renderStatusBar(margin, y, "Status Distribution");

        // 2. Priority Bar Chart
        const renderBar = (x, y, title) => {
            doc.setFontSize(9);
            doc.setTextColor(...COLORS.SECONDARY);
            doc.text(title, x, y - 5);

            const pd = aiReport.dashboard?.priorityDistribution || { high: 2, medium: 5, low: 3 };
            const maxVal = Math.max(pd.high, pd.medium, pd.low, 1);

            const bY = y + 30;
            const chartH = 20;
            doc.setDrawColor(...COLORS.BORDER);
            doc.line(x, bY, x + 60, bY); // X axis

            const drawPBar = (val, offset, color, label) => {
                const h = (val / maxVal) * chartH;
                doc.setFillColor(...color);
                doc.rect(x + offset, bY - h, 10, h, 'F');

                // Show Count
                doc.setFontSize(7);
                doc.setTextColor(...COLORS.PRIMARY);
                doc.text(String(val), x + offset + 5, bY - h - 2, { align: "center" });

                doc.setFontSize(6);
                doc.setTextColor(...COLORS.SECONDARY);
                doc.text(label, x + offset + 5, bY + 4, { align: "center" });
            };

            drawPBar(pd.high, 5, COLORS.CRITICAL, "High");
            drawPBar(pd.medium, 20, COLORS.RISK, "Med");
            drawPBar(pd.low, 35, COLORS.HEALTHY, "Low");
        };

        renderBar(margin + 80, y, "Priority Distribution");

        y += 45;
        // doc.addPage(); Remove page break to consolidate
    };

    // --- SECTION: PERFORMANCE ANALYTICS ---
    const renderAnalytics = () => {
        setH2();
        doc.text("Performance Analytics", margin, y);
        y += 12;

        // Burndown Chart (Simplified Visual)
        setH3();
        doc.text("Sprint Burndown Trend", margin, y);
        y += 10;

        const chartW = contentWidth - 40;
        const chartH = 40;
        const bX = margin + 20;
        const bY = y;

        doc.setDrawColor(...COLORS.BORDER);
        doc.line(bX, bY, bX, bY + chartH); // Y
        doc.line(bX, bY + chartH, bX + chartW, bY + chartH); // X

        // Ideal Line
        doc.setDrawColor(200, 200, 200);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(bX, bY, bX + chartW, bY + chartH);
        doc.setLineDashPattern([], 0);

        // Actual Line from Data
        const bd = aiReport.analytics?.burndown || { ideal: [], actual: [] };
        if (bd.actual && bd.actual.length > 0) {
            doc.setDrawColor(...COLORS.ACCENT);
            doc.setLineWidth(1);
            const stepW = chartW / (bd.ideal.length - 1 || 1);
            const maxVal = Math.max(...bd.ideal, 1);

            for (let i = 0; i < bd.actual.length; i++) {
                const px = bX + (i * stepW);
                const py = bY + (chartH - (bd.actual[i] / maxVal * chartH));

                // Draw line to next point
                if (i < bd.actual.length - 1) {
                    const nx = bX + ((i + 1) * stepW);
                    const ny = bY + (chartH - (bd.actual[i + 1] / maxVal * chartH));
                    doc.line(px, py, nx, ny);
                }

                // Draw Point
                doc.setFillColor(...COLORS.ACCENT);
                doc.circle(px, py, 0.8, 'F');

                // Label
                setCaption();
                doc.setFontSize(6);
                doc.text(String(bd.actual[i]), px, py - 2, { align: "center" });
            }
        } else {
            // Fallback trend line 
            doc.setDrawColor(...COLORS.ACCENT);
            doc.setLineWidth(1);
            doc.line(bX, bY, bX + 20, bY + 5);
            doc.line(bX + 20, bY + 5, bX + 40, bY + 12);
            doc.line(bX + 40, bY + 12, bX + 80, bY + 30);
            doc.line(bX + 80, bY + 30, bX + chartW, bY + chartH - 2);
        }

        y += chartH + 15;

        // Assignee Workload Bar Chart
        setH3();
        doc.text("Workload Distribution (Assignees)", margin, y);
        y += 10;

        const workload = aiReport.analytics?.workload || { assignees: [], points: [] };
        if (workload.assignees.length > 0) {
            workload.assignees.forEach((name, i) => {
                checkPageBreak(10);
                const rowY = y;
                setCaption();
                doc.text(maskData(name), margin, rowY + 4);

                const maxW = 100;
                const points = workload.points[i] || 0;
                const barLength = Math.min((points / 20) * maxW, maxW);

                doc.setFillColor(...COLORS.ACCENT);
                doc.rect(margin + 40, rowY, barLength, 5, 'F');
                doc.text(`${points} SP`, margin + 40 + barLength + 2, rowY + 4);
                y += 10;
            });
        } else {
            setBody();
            doc.text("No workload data available.", margin, y);
            y += 10;
        }

        y += 5;
        // doc.addPage(); // Remove forced page break to allow consolidation
    };

    // --- SECTION: ADVANCED ANALYTICS (PAGE 3) ---
    const renderAdvancedAnalytics = () => {
        checkPageBreak(40); // Check if we need a new page for the header
        setH2();
        doc.text("Advanced Sprint Analytics & Data Matrix", margin, y);
        y += 12;

        // 1. PIE CHART - Task Status Distribution
        const renderPie = (px, py, radius, title) => {
            setH3();
            doc.text(title, px, py);

            const sd = aiReport.dashboard?.statusDistribution || { todo: 10, inProgress: 30, review: 20, done: 40 };
            const statusData = [
                { label: "Done", val: sd.done || 0, color: COLORS.HEALTHY },
                { label: "Review", val: sd.review || 0, color: COLORS.RISK },
                { label: "Progress", val: sd.inProgress || 0, color: COLORS.ACCENT },
                { label: "Todo", val: sd.todo || 0, color: COLORS.SECONDARY }
            ].filter(d => d.val > 0);

            const total = statusData.reduce((acc, d) => acc + d.val, 0) || 1;
            let currentAngle = 0;
            const centerX = px + radius;
            const centerY = py + radius + 8;

            // Legend on right
            const legX = centerX + radius + 15;
            statusData.forEach((d, i) => {
                const angle = (d.val / total) * Math.PI * 2;

                // Draw sector using triangle approximation
                const steps = 40;
                doc.setFillColor(...d.color);
                for (let s = 0; s < steps; s++) {
                    const a1 = currentAngle + (angle * (s / steps));
                    const a2 = currentAngle + (angle * ((s + 1) / steps));
                    doc.triangle(
                        centerX, centerY,
                        centerX + Math.cos(a1) * radius, centerY + Math.sin(a1) * radius,
                        centerX + Math.cos(a2) * radius, centerY + Math.sin(a2) * radius,
                        'F'
                    );
                }

                // Inside percentage
                const midA = currentAngle + (angle / 2);
                const perc = Math.round((d.val / total) * 100);
                if (perc > 8) {
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(7);
                    doc.text(`${perc}%`,
                        centerX + Math.cos(midA) * (radius * 0.65),
                        centerY + Math.sin(midA) * (radius * 0.65),
                        { align: "center" }
                    );
                }

                // Legend
                doc.setFillColor(...d.color);
                doc.rect(legX, py + (i * 8) + 8, 3, 3, 'F');
                doc.setTextColor(...COLORS.TEXT);
                setCaption();
                doc.text(`${d.label} (${d.val})`, legX + 5, py + (i * 8) + 10.5);

                currentAngle += angle;
            });
        };

        renderPie(margin, y, 22, "Task Status Distribution");

        // 2. HEATMAP - Priority vs Status Risk Matrix
        const renderHeatmap = (hx, hy, title) => {
            setH3();
            doc.text(title, hx, hy);

            const priorities = ["High", "Medium", "Low"];
            const statuses = ["Todo", "Progress", "Review", "Done"];
            const cellW = 16;
            const cellH = 10;

            // Labels
            setCaption();
            statuses.forEach((s, i) => doc.text(s, hx + 18 + (i * cellW) + (cellW / 2), hy + 4, { align: "center" }));
            priorities.forEach((p, i) => doc.text(p, hx + 15, hy + 12 + (i * cellH) + (cellH / 2), { align: "right" }));

            // Data Matrix
            const matrix = {};
            priorities.forEach(p => { matrix[p] = {}; statuses.forEach(s => matrix[p][s] = 0); });
            tasks.forEach(t => {
                const p = t.priority?.charAt(0).toUpperCase() + t.priority?.slice(1) || "Medium";
                let s = "Todo";
                if (t.status === "completed" || t.status === "done") s = "Done";
                else if (t.status === "in_progress") s = "Progress";
                else if (t.status === "review") s = "Review";
                if (matrix[p] && matrix[p][s] !== undefined) matrix[p][s]++;
            });

            const maxCount = Math.max(...Object.values(matrix).flatMap(o => Object.values(o)), 1);

            priorities.forEach((p, r) => {
                statuses.forEach((s, c) => {
                    const count = matrix[p][s];
                    const intensity = count / maxCount;

                    const baseColor = COLORS.ACCENT;
                    const rC = 255 - ((255 - baseColor[0]) * intensity);
                    const gC = 255 - ((255 - baseColor[1]) * intensity);
                    const bC = 255 - ((255 - baseColor[2]) * intensity);

                    doc.setFillColor(rC, gC, bC);
                    doc.rect(hx + 18 + (c * cellW), hy + 12 + (r * cellH), cellW, cellH, 'F');
                    doc.setDrawColor(...COLORS.BORDER);
                    doc.setLineWidth(0.1);
                    doc.rect(hx + 18 + (c * cellW), hy + 12 + (r * cellH), cellW, cellH, 'S');

                    if (count > 0) {
                        doc.setTextColor(intensity > 0.5 ? 255 : 30);
                        doc.setFontSize(8);
                        doc.text(String(count), hx + 18 + (c * cellW) + (cellW / 2), hy + 12 + (r * cellH) + (cellH / 2) + 1, { align: "center" });
                    }
                });
            });
        };

        renderHeatmap(margin + 105, y, "Priority Risk Heatmap");
        y += 65;

        // 3. AREA GRAPH - Sprint Progress Trend
        const renderAreaGraph = (gx, gy, title) => {
            setH3();
            doc.text(title, gx, gy);
            gy += 10;

            const chartW = contentWidth;
            const chartH = 45;

            doc.setDrawColor(...COLORS.BORDER);
            doc.setLineWidth(0.2);
            doc.line(gx, gy + chartH, gx + chartW, gy + chartH); // X
            doc.line(gx, gy, gx, gy + chartH); // Y

            const bd = aiReport.analytics?.burndown || { ideal: [], actual: [] };
            const steps = bd.ideal.length - 1 || 1;
            const stepW = chartW / steps;
            const maxVal = Math.max(...bd.ideal, ...bd.actual, 1);

            // Areas (Decomposed into triangles for compatibility)
            const basY = gy + chartH;

            // Ideal Area
            doc.setFillColor(240, 240, 250);
            for (let i = 0; i < bd.ideal.length - 1; i++) {
                const ix1 = gx + (i * stepW);
                const iy1 = gy + (chartH - (bd.ideal[i] / maxVal * chartH));
                const ix2 = gx + ((i + 1) * stepW);
                const iy2 = gy + (chartH - (bd.ideal[i + 1] / maxVal * chartH));
                doc.triangle(ix1, basY, ix1, iy1, ix2, iy2, 'F');
                doc.triangle(ix1, basY, ix2, iy2, ix2, basY, 'F');
            }

            // Actual Area
            doc.setFillColor(230, 245, 235);
            for (let i = 0; i < bd.actual.length - 1; i++) {
                const ax1 = gx + (i * stepW);
                const ay1 = gy + (chartH - (bd.actual[i] / maxVal * chartH));
                const ax2 = gx + ((i + 1) * stepW);
                const ay2 = gy + (chartH - (bd.actual[i + 1] / maxVal * chartH));
                doc.triangle(ax1, basY, ax1, ay1, ax2, ay2, 'F');
                doc.triangle(ax1, basY, ax2, ay2, ax2, basY, 'F');
            }

            doc.setLineWidth(0.6);
            doc.setDrawColor(180, 180, 180);
            for (let i = 0; i < steps; i++) {
                doc.line(gx + (i * stepW), gy + (chartH - (bd.ideal[i] / maxVal * chartH)),
                    gx + ((i + 1) * stepW), gy + (chartH - (bd.ideal[i + 1] / maxVal * chartH)));
            }

            doc.setDrawColor(...COLORS.HEALTHY);
            doc.setLineWidth(1.2);
            for (let i = 0; i < bd.actual.length - 1; i++) {
                doc.line(gx + (i * stepW), gy + (chartH - (bd.actual[i] / maxVal * chartH)),
                    gx + ((i + 1) * stepW), gy + (chartH - (bd.actual[i + 1] / maxVal * chartH)));
                doc.setFillColor(255, 255, 255);
                doc.circle(gx + (i * stepW), gy + (chartH - (bd.actual[i] / maxVal * chartH)), 0.6, 'FD');
            }

            setCaption();
            doc.setFillColor(180, 180, 180); doc.rect(gx, gy + chartH + 10, 3, 3, 'F');
            doc.text("Ideal Path", gx + 5, gy + chartH + 12.5);
            doc.setFillColor(...COLORS.HEALTHY); doc.rect(gx + 35, gy + chartH + 10, 3, 3, 'F');
            doc.text("Actual Progress", gx + 40, gy + chartH + 12.5);
        };

        renderAreaGraph(margin, y, "Sprint Completion Trend (Burn-down)");
        y += 65; // Update global y after Area Graph to prevent collision
    };

    // --- SECTION: RISK ANALYSIS ---
    const renderRisks = () => {
        doc.addPage();
        y = 25; // Reset y for new page
        setH2();
        doc.text("Bottleneck & Risk Analysis", margin, y);
        y += 12;

        const renderAlert = (title, items, color) => {
            if (!items || items.length === 0) return;
            checkPageBreak(30);
            doc.setFillColor(...color);
            doc.rect(margin, y, 4, 10, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(...color);
            doc.text(title, margin + 6, y + 7);
            y += 12;

            setBody();
            items.forEach(item => {
                const text = `• ${maskData(item)}`;
                const lines = doc.splitTextToSize(text, contentWidth - 10);
                const heightNeeded = lines.length * 6;
                checkPageBreak(heightNeeded);
                doc.text(lines, margin + 6, y);
                y += heightNeeded + 1;
            });
            y += 4;
        };

        renderAlert("CRITICAL ISSUES (RED)", aiReport.analysis?.critical, COLORS.CRITICAL);
        renderAlert("RISK AREAS (YELLOW)", aiReport.analysis?.risks, COLORS.RISK);
        renderAlert("POSITIVE OBSERVATIONS (GREEN)", aiReport.analysis?.positive, COLORS.HEALTHY);

        y += 10;
    };

    // --- SECTION: RECOMMENDATIONS ---
    const renderRecommendations = () => {
        checkPageBreak(50);
        setH2();
        doc.text("Strategic Recommendations", margin, y);
        y += 15;

        const renderCategory = (title, items) => {
            if (!items || items.length === 0) return;
            checkPageBreak(25);
            setH3();
            doc.text(title, margin, y);
            y += 8;
            setBody();
            items.forEach(item => {
                const text = `- ${maskData(item)}`;
                const lines = doc.splitTextToSize(text, contentWidth - 8);
                const heightNeeded = lines.length * 6;
                checkPageBreak(heightNeeded);
                doc.text(lines, margin, y);
                y += heightNeeded + 1;
            });
            y += 6;
        };

        const recs = aiReport.recommendations || {};
        renderCategory("Immediate Actions (Next 48 Hours)", recs.immediate);
        renderCategory("Next Sprint Improvements", recs.nextSprint);
        renderCategory("Process Optimization", recs.process);
    };

    // --- EXECUTE RENDERING ---
    renderCoverPage();
    renderDashboard();
    renderAnalytics();
    renderAdvancedAnalytics();
    renderRisks();
    renderRecommendations();

    // Final Touch: Header/Footer
    addHeaderFooter();

    return doc.output('blob');
};

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

export const generateBrandedDocumentPDF = async (htmlContent, metadata) => {
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

export const generateTimesheetReportPDF = (timesheets, filters) => {
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

export const generateProjectReportPDF = (project, analytics, aiReport, userMap = {}) => {
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

export const generatePdfFromHtml = async (element, filename = 'report') => {
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
