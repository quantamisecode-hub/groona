import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProjectTemplates from "../components/projects/ProjectTemplates";
import { toast } from "sonner";
import { addDays, format } from "date-fns";

export default function ProjectTemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = React.useState(null);

  React.useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const createProjectFromTemplate = useMutation({
    mutationFn: async (template) => {
      // Create project from template
      const projectData = {
        tenant_id: currentUser?.tenant_id,
        name: `${template.name} - ${format(new Date(), 'MMM d, yyyy')}`,
        description: template.description,
        status: template.default_status || 'planning',
        priority: template.default_priority || 'medium',
        template_id: template.id,
        owner: currentUser?.email,
      };

      if (template.estimated_duration_days) {
        projectData.start_date = format(new Date(), 'yyyy-MM-dd');
        projectData.deadline = format(addDays(new Date(), template.estimated_duration_days), 'yyyy-MM-dd');
      }

      const newProject = await groonabackend.entities.Project.create(projectData);

      // Create tasks from template
      if (template.task_templates && template.task_templates.length > 0) {
        const taskPromises = template.task_templates.map(taskTemplate => {
          return groonabackend.entities.Task.create({
            tenant_id: currentUser?.tenant_id,
            project_id: newProject.id,
            title: taskTemplate.title,
            description: taskTemplate.description || '',
            task_type: taskTemplate.task_type || 'task',
            priority: taskTemplate.priority || 'medium',
            status: 'todo',
            estimated_hours: taskTemplate.estimated_hours || 0,
            reporter: currentUser?.email,
          });
        });

        await Promise.all(taskPromises);
      }

      // Update template usage count
      await groonabackend.entities.ProjectTemplate.update(template.id, {
        usage_count: (template.usage_count || 0) + 1,
      });

      // Create activity
      if (currentUser) {
        await groonabackend.entities.Activity.create({
          tenant_id: currentUser.tenant_id,
          action: 'created',
          entity_type: 'project',
          entity_id: newProject.id,
          entity_name: newProject.name,
          project_id: newProject.id,
          user_email: currentUser.email,
          user_name: currentUser.full_name,
          details: `Created from template: ${template.name}`,
        });
      }

      return newProject;
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-templates'] });
      toast.success('Project created from template!');
      navigate(`${createPageUrl('ProjectDetail')}?id=${newProject.id}`);
    },
    onError: (error) => {
      console.error('Error creating project from template:', error);
      toast.error('Failed to create project from template');
    },
  });

  const handleSelectTemplate = (template) => {
    if (confirm(`Create a new project using the "${template.name}" template?`)) {
      createProjectFromTemplate.mutate(template);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      <ProjectTemplates onSelectTemplate={handleSelectTemplate} />
    </div>
  );
}

