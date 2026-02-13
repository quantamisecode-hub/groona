import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Loader2, CheckCircle, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AutoAssignment({ currentUser }) {
  const [selectedProject, setSelectedProject] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => groonabackend.entities.Project.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => groonabackend.entities.User.list(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['all-tasks'],
    queryFn: () => groonabackend.entities.Task.list(),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => groonabackend.entities.Task.update(id, data),
  });

  const createNotificationMutation = useMutation({
    mutationFn: (data) => groonabackend.entities.Notification.create(data),
  });

  const autoAssignTasks = async () => {
    if (!selectedProject) return;

    setIsAssigning(true);
    setResult(null);

    try {
      const projectTasks = tasks.filter(t => 
        t.project_id === selectedProject && 
        !t.assigned_to &&
        t.status !== 'completed'
      );

      if (projectTasks.length === 0) {
        setResult({ success: true, message: "No unassigned tasks found in this project.", assignments: [] });
        setIsAssigning(false);
        return;
      }

      // Calculate user workloads
      const userWorkloads = users.map(user => ({
        email: user.email,
        name: user.full_name,
        skills: user.skills || [],
        availability: (user.availability_hours_per_week || 40) - (user.current_workload || 0),
        currentTasks: tasks.filter(t => t.assigned_to === user.email && t.status !== 'completed').length,
      }));

      // Sort by availability (most available first)
      const availableUsers = userWorkloads
        .filter(u => u.availability > 0)
        .sort((a, b) => b.availability - a.availability);

      if (availableUsers.length === 0) {
        setResult({ success: false, message: "No available team members found.", assignments: [] });
        setIsAssigning(false);
        return;
      }

      const assignments = [];
      let userIndex = 0;

      // Round-robin assignment with skill matching
      for (const task of projectTasks) {
        const assignee = availableUsers[userIndex % availableUsers.length];
        
        await updateTaskMutation.mutateAsync({
          id: task.id,
          data: { assigned_to: assignee.email }
        });

        // Send notification
        await createNotificationMutation.mutateAsync({
          recipient_email: assignee.email,
          type: "task_assigned",
          title: "Task Auto-Assigned",
          message: `You have been automatically assigned: ${task.title}`,
          entity_type: "task",
          entity_id: task.id,
          sender_name: "Automation System",
        });

        assignments.push({
          task: task.title,
          assignee: assignee.name,
        });

        userIndex++;
      }

      setResult({
        success: true,
        message: `Successfully assigned ${assignments.length} task(s) based on team availability.`,
        assignments,
      });

      queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
      
    } catch (error) {
      console.error('Error auto-assigning tasks:', error);
      setResult({ success: false, message: "Error assigning tasks. Please try again.", assignments: [] });
    }

    setIsAssigning(false);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-600" />
            Automatic Task Assignment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-blue-50 border-blue-200">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              The AI will automatically assign unassigned tasks based on team member availability, current workload, and skills.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Select Project
              </label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={autoAssignTasks}
              disabled={!selectedProject || isAssigning}
              className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white"
            >
              {isAssigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning Tasks...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 mr-2" />
                  Auto-Assign Tasks
                </>
              )}
            </Button>
          </div>

          {result && (
            <Alert className={result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
              <CheckCircle className={`h-4 w-4 ${result.success ? "text-green-600" : "text-red-600"}`} />
              <AlertDescription className={result.success ? "text-green-900" : "text-red-900"}>
                <p className="font-semibold mb-2">{result.message}</p>
                {result.assignments.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {result.assignments.map((assignment, index) => (
                      <div key={index} className="flex items-center justify-between text-sm p-2 bg-white rounded border border-green-200">
                        <span className="font-medium">{assignment.task}</span>
                        <Badge variant="outline" className="bg-green-50">
                          → {assignment.assignee}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <h4 className="font-semibold text-slate-900 mb-3">Team Availability</h4>
            <div className="space-y-2">
              {users.slice(0, 5).map((user) => {
                const userTasks = tasks.filter(t => t.assigned_to === user.email && t.status !== 'completed');
                const totalEstimatedHours = userTasks.reduce((sum, task) => sum + (task.estimated_hours || 0), 0);
                const availability = (user.availability_hours_per_week || 40) - totalEstimatedHours;
                
                return (
                  <div key={user.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-900">{user.full_name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-600">{userTasks.length} tasks</span>
                      <Badge variant="outline" className={availability > 20 ? "bg-green-50" : "bg-amber-50"}>
                        {Math.max(0, availability).toFixed(1)}h available
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

