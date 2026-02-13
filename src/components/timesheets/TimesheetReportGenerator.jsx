import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Download,
  Calendar as CalendarIcon,
  Loader2,
  FileText,
  TrendingUp
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

export default function TimesheetReportGenerator({
  currentUser,
  effectiveTenantId,
  users = [],
  allTimesheets = []
}) {
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [reportPeriod, setReportPeriod] = useState("this-month");
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Fetch tenant for branding
  const { data: tenant } = useQuery({
    queryKey: ['tenant-for-report', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return null;
      try {
        // Fix: Use _id for filtering to match database schema
        const tenants = await groonabackend.entities.Tenant.filter({ _id: effectiveTenantId });
        return tenants[0] || null;
      } catch (error) {
        console.error('Failed to fetch tenant:', error);
        return null;
      }
    },
    enabled: !!effectiveTenantId,
    retry: false,
  });

  const getDateRange = () => {
    const today = new Date();

    switch (reportPeriod) {
      case 'today':
        return { start: today, end: today };
      case 'this-week':
        return { start: startOfWeek(today), end: endOfWeek(today) };
      case 'this-month':
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case 'last-3-months':
        return { start: subMonths(today, 3), end: today };
      case 'last-6-months':
        return { start: subMonths(today, 6), end: today };
      case 'last-year':
        return { start: subMonths(today, 12), end: today };
      case 'custom':
        return { start: customStartDate, end: customEndDate };
      default:
        return { start: startOfMonth(today), end: endOfMonth(today) };
    }
  };

  const generatePDFReport = async () => {
    setGenerating(true);

    try {
      const { start, end } = getDateRange();

      if (!start || !end) {
        toast.error('Please select valid date range');
        setGenerating(false);
        return;
      }

      // Filter timesheets
      let filteredTimesheets = (allTimesheets || []).filter(t => {
        if (!t.date) return false;
        const entryDate = new Date(t.date);
        return entryDate >= start && entryDate <= end && t.status === 'approved';
      });

      let employeeData = null;
      let userProfile = null;
      if (selectedEmployee !== "all") {
        filteredTimesheets = filteredTimesheets.filter(t => t.user_email === selectedEmployee);
        employeeData = users.find(u => u.email === selectedEmployee);

        // Fetch User Profile for accurate Job Title & Address
        if (employeeData) {
          try {
            // Fetch just-in-time
            const profiles = await groonabackend.entities.UserProfile.filter({ user_id: employeeData.id });
            userProfile = profiles[0] || null;
          } catch (err) {
            console.error("Failed to fetch user profile for report", err);
          }
        }
      }

      if (filteredTimesheets.length === 0) {
        toast.error('No approved timesheets found for the selected period');
        setGenerating(false);
        return;
      }

      // Initialize PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;

      // === 1. HEADER ===
      // Logo & Company Name
      const logoUrl = tenant?.branding?.logo_url || tenant?.logo_url;
      if (logoUrl) {
        try {
          doc.addImage(logoUrl, 'PNG', 20, 15, 20, 20);
        } catch (e) {
          doc.setFillColor(240, 240, 240);
          doc.rect(20, 15, 20, 20, 'F');
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text("LOGO", 23, 27);
        }
      } else {
        doc.setFillColor(240, 240, 240);
        doc.rect(20, 15, 20, 20, 'F');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text("LOGO", 23, 27);
      }

      // Company Name
      // Company Name & Details
      doc.setFontSize(18);
      doc.setTextColor(30, 58, 138); // Dark Blue
      doc.setFont("helvetica", "bold");
      doc.text(tenant?.name || 'Company Name', 45, 22);

      // Company Details
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");

      const loc = [tenant?.company_city, tenant?.company_country].filter(Boolean).join(', ') || 'Headquarters';
      const phone = tenant?.company_phone ? `Phone: ${tenant.company_phone}` : 'Phone: N/A';
      const email = tenant?.billing_email ? `Email: ${tenant.billing_email}` : 'Email: N/A';
      const website = tenant?.branding?.company_website || '';

      doc.text(loc, 45, 27);
      doc.text(`${phone} | ${email} ${website ? '| ' + website : ''}`, 45, 32);

      // Report Info (Top Right)
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text("Confidential – Internal Use Only", pageWidth - 20, 20, { align: 'right' });

      doc.setTextColor(80, 80, 80);
      doc.text(`Generated On: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, pageWidth - 20, 25, { align: 'right' });
      doc.text(`Generated By: ${currentUser.full_name || 'System'}`, pageWidth - 20, 30, { align: 'right' });

      yPos = 50;

      // === 2. METADATA SECTION ===
      // Draw box
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(20, yPos, pageWidth - 40, 35, 2, 2, 'FD');

      // Employee Info (Left)
      const empName = employeeData ? employeeData.full_name : "All Employees";

      // ID -> Show Email address as requested
      const empID = employeeData ? employeeData.email : "N/A";

      // Role -> Show Job Title from Profile (priority) or User Entity
      const role = userProfile?.job_title || employeeData?.job_title || employeeData?.title || employeeData?.role || "N/A";

      // Determine Project (if mostly one project)
      const projects = [...new Set(filteredTimesheets.map(t => t.project_name))];
      const projectDisplay = projects.length === 1 ? projects[0] : (projects.length > 1 ? "Multiple Projects" : "N/A");

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);

      // Col 1
      doc.setFont("helvetica", "bold");
      doc.text("Employee Name:", 25, yPos + 8);
      doc.setFont("helvetica", "normal");
      doc.text(empName, 60, yPos + 8);

      doc.setFont("helvetica", "bold");
      doc.text("Email ID:", 25, yPos + 16);
      doc.setFont("helvetica", "normal");
      doc.text(empID, 60, yPos + 16);

      doc.setFont("helvetica", "bold");
      doc.text("Title:", 25, yPos + 24);
      doc.setFont("helvetica", "normal");
      doc.text(role, 60, yPos + 24);

      // Col 2
      doc.setFont("helvetica", "bold");
      doc.text("Project:", 110, yPos + 8);
      doc.setFont("helvetica", "normal");
      doc.text(projectDisplay, 135, yPos + 8);

      doc.setFont("helvetica", "bold");
      doc.text("Date Range:", 110, yPos + 16);
      doc.setFont("helvetica", "normal");
      doc.text(`${format(start, 'dd MMM yyyy')} – ${format(end, 'dd MMM yyyy')}`, 135, yPos + 16);

      doc.setFont("helvetica", "bold");
      doc.text("Report Type:", 110, yPos + 24);
      doc.setFont("helvetica", "normal");
      doc.text(reportPeriod === 'this-month' ? "Monthly Timesheet" : "Custom Period Report", 135, yPos + 24);

      yPos += 45;

      // === 3. DETAILED ENTRIES TABLE ===
      doc.setFontSize(12);
      doc.setTextColor(30, 58, 138);
      doc.setFont("helvetica", "bold");
      doc.text("Detailed Time Entries", 20, yPos);
      yPos += 8;

      // Table Header
      const col = {
        date: 20,
        project: 45,
        task: 85,
        hours: 145,
        location: 170
      };

      doc.setFillColor(30, 58, 138); // Header Blue
      doc.rect(20, yPos, pageWidth - 40, 8, 'F');

      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('Date', col.date + 2, yPos + 6);
      doc.text('Project', col.project + 2, yPos + 6);
      doc.text('Task', col.task + 2, yPos + 6);
      doc.text('Hours', col.hours + 2, yPos + 6);
      doc.text('Location', col.location + 2, yPos + 6);

      yPos += 8;

      // Rows
      doc.setTextColor(60, 60, 60);
      doc.setFont("helvetica", "normal");

      filteredTimesheets.forEach((entry, index) => {
        // Stripe
        if (index % 2 === 0) {
          doc.setFillColor(245, 247, 250);
          doc.rect(20, yPos, pageWidth - 40, 7, 'F');
        }

        doc.setFontSize(8);
        doc.text(format(new Date(entry.date), 'dd MMM'), col.date + 2, yPos + 5);

        // Truncate text logic
        const trunc = (str, n) => str && str.length > n ? str.substr(0, n - 1) + '...' : str || '-';

        doc.text(trunc(entry.project_name, 20), col.project + 2, yPos + 5);
        doc.text(trunc(entry.task_title, 35), col.task + 2, yPos + 5);

        // Hours
        const hrs = `${entry.hours}h ${entry.minutes}m`;
        const billableMarker = entry.is_billable ? " (Billable)" : "";
        doc.text(hrs + billableMarker, col.hours + 2, yPos + 5);

        // Location - City, State
        let locationDisplay = "N/A";
        const loc = entry.location_data || entry.clock_in_location;

        if (loc) {
          const city = loc.city;
          const state = loc.region || loc.state || loc.principalSubdivision;

          if (city && state) {
            locationDisplay = `${city}, ${state}`;
          } else if (city) {
            locationDisplay = city;
          } else if (loc.address) {
            // Fallback to address if no structured city/state
            locationDisplay = loc.address;
          }
        }

        // Fallback to User Profile Address if Entry Location is N/A
        if ((!locationDisplay || locationDisplay === "N/A") && userProfile?.address) {
          locationDisplay = userProfile.address; // City, State from profile
        }

        doc.text(trunc(locationDisplay, 25), col.location + 2, yPos + 5);

        yPos += 7;

        // Page break
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
          // Re-draw header reduced
          doc.setFillColor(30, 58, 138);
          doc.rect(20, yPos, pageWidth - 40, 8, 'F');
          doc.setFontSize(9);
          doc.setTextColor(255, 255, 255);
          doc.text('Date', col.date + 2, yPos + 6);
          doc.text('Project', col.project + 2, yPos + 6);
          doc.text('Task', col.task + 2, yPos + 6);
          doc.text('Hours', col.hours + 2, yPos + 6);
          doc.text('Location', col.location + 2, yPos + 6);
          yPos += 8;
          doc.setTextColor(60, 60, 60);
        }
      });

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount} | Generated for Internal Use`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }

      // Save
      const fileName = `Timesheet_Report_${empName.replace(/\s+/g, '_')}_${format(start, 'yyyy-MM-dd')}_to_${format(end, 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);

      toast.success('Report generated successfully!');
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Generate Professional Timesheet Reports
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Employee Selection */}
        <div className="space-y-2">
          <Label>Select Employee</Label>
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {(users || []).map(user => (
                <SelectItem key={user.id} value={user.email}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 ring-2 ring-slate-400 ring-offset-1">
                      <AvatarImage src={user.profile_image_url} />
                      <AvatarFallback className="text-[10px]">
                        {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-slate-600 font-medium">{user.full_name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Period Selection */}
        <div className="space-y-2">
          <Label>Report Period</Label>
          <Select value={reportPeriod} onValueChange={setReportPeriod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-3-months">Last 3 Months</SelectItem>
              <SelectItem value="last-6-months">Last 6 Months</SelectItem>
              <SelectItem value="last-year">Last Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Custom Date Range */}
        {reportPeriod === 'custom' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !customStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStartDate ? format(customStartDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={customStartDate}
                    onSelect={setCustomStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !customEndDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEndDate ? format(customEndDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={customEndDate}
                    onSelect={setCustomEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* Report Preview Info */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Report Will Include:
          </h4>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Company branding and information</li>
            <li>Summary statistics (total hours, billable hours, entries)</li>
            <li>Time breakdown by project and task</li>
            <li>Detailed table of all time entries</li>
            <li>Location information for each entry</li>
            <li>Professional visual formatting</li>
          </ul>
        </div>

        {/* Generate Button */}
        <Button
          onClick={generatePDFReport}
          disabled={generating}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
          size="lg"
        >
          {generating ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Generating Report...
            </>
          ) : (
            <>
              <Download className="h-5 w-5 mr-2" />
              Generate PDF Report
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

