import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Target, CheckSquare, BarChart3, Users, Ban } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { jsPDF } from "jspdf";

export default function SprintSnapshotView({ sprint, tasks, users }) {
  const totalPoints = tasks.reduce((acc, t) => acc + (t.story_points || 0), 0);
  const blockedTasks = tasks.filter(t => t.dependencies && t.dependencies.length > 0); // Simplified blocked check
  
  // Points by Assignee
  const pointsByAssignee = {};
  tasks.forEach(t => {
    const assignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
    if (assignees.length === 0) {
      pointsByAssignee['Unassigned'] = (pointsByAssignee['Unassigned'] || 0) + (t.story_points || 0);
    } else {
      assignees.forEach(email => {
        // Split points among assignees? Or count full points? Usually full points for load, but here let's just sum
        pointsByAssignee[email] = (pointsByAssignee[email] || 0) + (t.story_points || 0);
      });
    }
  });

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text(`Sprint Snapshot: ${sprint.name}`, 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Goal: ${sprint.goal || 'No goal set'}`, 20, 30);
    doc.text(`Status: ${sprint.status}`, 20, 40);
    
    doc.text(`Total Stories: ${tasks.length}`, 20, 55);
    doc.text(`Total Points: ${totalPoints}`, 20, 65);
    
    doc.text("Breakdown by Assignee:", 20, 80);
    let y = 90;
    Object.entries(pointsByAssignee).forEach(([email, points]) => {
      doc.text(`- ${users.find(u => u.email === email)?.full_name || email}: ${points} pts`, 30, y);
      y += 10;
    });

    doc.save(`${sprint.name}-snapshot.pdf`);
  };

  if (!sprint.locked_date && sprint.status === 'draft') {
    return (
      <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-lg">
        <p>Sprint snapshot will appear once you've locked the sprint.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handleExportPDF} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export as PDF
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sprint Goal</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold italic">"{sprint.goal || 'No goal'}"</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scope</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.length} Stories</div>
            <p className="text-xs text-muted-foreground">{totalPoints} Total Points</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risks</CardTitle>
            <Ban className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{blockedTasks.length}</div>
            <p className="text-xs text-muted-foreground">Blocked Items</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Points Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(pointsByAssignee).map(([email, points]) => {
              const user = users.find(u => u.email === email);
              return (
                <div key={email} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{user?.full_name || email}</div>
                  </div>
                  <div className="font-bold">{points} pts</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}