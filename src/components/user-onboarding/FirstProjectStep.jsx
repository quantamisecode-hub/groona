import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Rocket, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function FirstProjectStep({ data, tenant, user, onNext }) {
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    project_name: data.first_project?.project_name || '',
    project_type: data.first_project?.project_type || (tenant?.company_type === 'MARKETING' ? 'campaign' : 'agile'),
    start_date: data.first_project?.start_date || new Date().toISOString().split('T')[0],
    end_date: data.first_project?.end_date || '',
    generate_with_ai: data.first_project?.generate_with_ai ?? true
  });

  const projectTypes = tenant?.company_type === 'MARKETING'
    ? [
        { value: 'campaign', label: 'Marketing Campaign' },
        { value: 'content', label: 'Content Project' },
        { value: 'social', label: 'Social Media' }
      ]
    : [
        { value: 'agile', label: 'Agile / Scrum' },
        { value: 'kanban', label: 'Kanban' }
      ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      // 1. Create the project
      // Note: We use 'project_manager' as requested
      const projectData = {
        tenant_id: tenant.id,
        name: formData.project_name,
        status: 'planning',
        priority: 'medium',
        owner: user.email,
        start_date: formData.start_date,
        deadline: formData.end_date || undefined,
        progress: 0,
        team_members: [
          {
            email: user.email,
            role: 'project_manager' 
          }
        ]
      };

      const project = await groonabackend.entities.Project.create(projectData);

      if (!project || !project.id) {
         throw new Error("Failed to receive valid project ID from server.");
      }

      // CRITICAL: Create the ProjectUserRole entry so the Dashboard can see it
      await groonabackend.entities.ProjectUserRole.create({
        tenant_id: tenant.id,
        user_id: user.id,
        project_id: project.id,
        role: 'project_manager'
      });

      // 2. Create workspace if doesn't exist
      const workspaces = await groonabackend.entities.Workspace.filter({ tenant_id: tenant.id });
      let workspace;
      if (workspaces.length === 0) {
        workspace = await groonabackend.entities.Workspace.create({
          tenant_id: tenant.id,
          name: 'Default Workspace',
          description: 'Your main workspace',
          is_default: true,
          owner_id: user.id,
          owner_email: user.email,
          owner_name: user.full_name,
          members: [
            {
              user_id: user.id,
              user_email: user.email,
              user_name: user.full_name || user.email,
              role: 'admin'
            }
          ],
          created_by: user.email
        });
      } else {
        workspace = workspaces[0];
      }

      // 3. Assign workspace to project
      await groonabackend.entities.Project.update(project.id, {
        workspace_id: workspace.id
      });

      // 4. AI Generation if enabled
      if (formData.generate_with_ai) {
        try {
          const taskPrompt = tenant?.company_type === 'MARKETING'
            ? `Generate 5 initial tasks for a marketing campaign project named "${formData.project_name}". Include tasks like strategy, content creation, design, and launch preparation.`
            : `Generate 5 initial tasks for a software project named "${formData.project_name}". Include tasks like requirements gathering, design, development, testing, and deployment.`;

          const aiResponse = await groonabackend.integrations.Core.InvokeLLM({
            prompt: taskPrompt,
            response_json_schema: {
              type: "object",
              properties: {
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      priority: { type: "string", enum: ["low", "medium", "high"] }
                    }
                  }
                }
              }
            }
          });

          // Create tasks
          if (aiResponse?.tasks) {
            for (const task of aiResponse.tasks) {
              await groonabackend.entities.Task.create({
                tenant_id: tenant.id,
                workspace_id: workspace.id,
                project_id: project.id,
                title: task.title,
                description: task.description,
                priority: task.priority || 'medium',
                status: 'todo',
                task_type: 'task',
                reporter: user.email,
                ai_generated: true
              });
            }
          }

          toast.success('Project created with AI-generated tasks!');
        } catch (aiError) {
          console.error('AI generation failed:', aiError);
          toast.warning('Project created, but AI task generation failed');
        }
      } else {
        toast.success('Project created successfully!');
      }

      // 5. Log activity
      await groonabackend.entities.Activity.create({
        tenant_id: tenant.id,
        action: 'created',
        entity_type: 'project',
        entity_id: project.id,
        entity_name: project.name,
        project_id: project.id,
        user_email: user.email,
        user_name: user.full_name,
        details: 'Created first project during onboarding'
      });

      // 6. Mark project creation as complete in onboarding
      await groonabackend.entities.Tenant.update(tenant.id, {
        onboarding_data: {
          ...(tenant.onboarding_data || {}),
          completed_steps: [
            ...(tenant.onboarding_data?.completed_steps || []),
            'workspace_created',
            'project_created'
          ]
        }
      });

      // Complete onboarding
      onNext({ project_id: project.id, ...formData });
      
    } catch (error) {
      console.error('Failed to create project:', error);
      const errMsg = error.response?.data?.error || error.message || 'Failed to create project.';
      toast.error(`Error: ${errMsg}`);
      setIsCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="text-center mb-8">
        <Rocket className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Create your first {tenant?.company_type === 'MARKETING' ? 'campaign' : 'project'}
        </h2>
        <p className="text-slate-600">
          Let's get you started with something to work on
        </p>
      </div>

      {/* Project Name */}
      <div className="space-y-2">
        <Label htmlFor="project_name">
          {tenant?.company_type === 'MARKETING' ? 'Campaign' : 'Project'} Name *
        </Label>
        <Input
          id="project_name"
          value={formData.project_name}
          onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
          placeholder={tenant?.company_type === 'MARKETING' ? 'Q1 Social Media Campaign' : 'Mobile App Development'}
          className="text-lg"
          required
        />
      </div>

      {/* Project Type */}
      <div className="space-y-2">
        <Label htmlFor="project_type">Type *</Label>
        <Select
          value={formData.project_type}
          onValueChange={(value) => setFormData({ ...formData, project_type: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {projectTypes.map(type => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">Start Date *</Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End Date (Optional)</Label>
          <Input
            id="end_date"
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            min={formData.start_date}
          />
        </div>
      </div>

      {/* AI Generation Toggle */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-blue-600" />
          <div>
            <h4 className="font-medium text-slate-900">Generate plan with AI</h4>
            <p className="text-sm text-slate-600">
              Auto-create tasks and milestones to get started faster
            </p>
          </div>
        </div>
        <Switch
          checked={formData.generate_with_ai}
          onCheckedChange={(checked) => setFormData({ ...formData, generate_with_ai: checked })}
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
        size="lg"
        disabled={!formData.project_name || !formData.project_type || !formData.start_date || isCreating}
      >
        {isCreating ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Rocket className="h-5 w-5 mr-2" />
            Launch Workspace
          </>
        )}
      </Button>
    </form>
  );
}

