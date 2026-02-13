import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderKanban, Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ProjectSetupStep({ tenant, user, onNext, onSkip, onBack }) {
  const [projects, setProjects] = useState([
    { name: "", description: "", priority: "medium" },
  ]);
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  const addProject = () => {
    if (projects.length < 3) {
      setProjects([...projects, { name: "", description: "", priority: "medium" }]);
    }
  };

  const removeProject = (index) => {
    setProjects(projects.filter((_, i) => i !== index));
  };

  const updateProject = (index, field, value) => {
    const updated = [...projects];
    updated[index][field] = value;
    setProjects(updated);
  };

  const handleAISuggestions = async (projectIndex = 0) => {
    const projectName = projects[projectIndex]?.name?.trim();
    
    if (!projectName) {
      toast.error("Please enter project name first");
      return;
    }

    setAiGenerating(true);
    try {
      const companyType = tenant.company_type || 'SOFTWARE';
      const industryContext = companyType === 'MARKETING' 
        ? 'marketing agency focused on campaigns, content creation, and client deliverables'
        : 'software development company focused on building applications and digital products';
      
      const prompt = `Based on the project name "${projectName}" for a ${industryContext} company named "${tenant.name}", generate:
      - A brief description (2-3 sentences) explaining what this project is about and its objectives
      - A priority level (low, medium, high, or urgent) based on the project's importance and urgency
      
      The description should be relevant to the project name "${projectName}" and appropriate for a ${industryContext}. Return the response as a JSON object with "description" and "priority" fields.`;

      const response = await groonabackend.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            description: { type: "string" },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent"] }
          },
          required: ["description", "priority"]
        }
      });

      console.log('AI Response:', response);

      // Handle different response formats
      let description = '';
      let priority = 'medium';

      if (response.description && response.priority) {
        description = response.description;
        priority = response.priority;
      } else if (response.data) {
        description = response.data.description || '';
        priority = response.data.priority || 'medium';
      }

      if (description) {
        // Update only description and priority, keep the project name
        const updatedProjects = [...projects];
        updatedProjects[projectIndex] = {
          ...updatedProjects[projectIndex],
          description: description,
          priority: priority
        };
        setProjects(updatedProjects);
        toast.success("AI generated description and priority!");
      } else {
        toast.error("No suggestions generated. Please try again.");
      }
    } catch (error) {
      console.error('AI Suggestion Error:', error);
      toast.error("Failed to generate suggestions: " + (error.message || "Please try again"));
    } finally {
      setAiGenerating(false);
    }
  };

  const handleNext = async () => {
    const validProjects = projects.filter(p => p.name.trim());
    
    if (validProjects.length === 0) {
      toast.error("Please add at least one project or skip this step");
      return;
    }

    setLoading(true);
    try {
      const createdProjects = [];
      
      for (const project of validProjects) {
        const newProject = await groonabackend.entities.Project.create({
          tenant_id: tenant.id,
          name: project.name.trim(),
          description: project.description.trim(),
          priority: project.priority,
          status: "planning",
          owner: user.email,
          progress: 0,
        });

        // Create activity
        await groonabackend.entities.Activity.create({
          tenant_id: tenant.id,
          action: 'created',
          entity_type: 'project',
          entity_id: newProject.id,
          entity_name: newProject.name,
          project_id: newProject.id,
          user_email: user.email,
          user_name: user.full_name,
          details: 'Created during onboarding',
        });

        createdProjects.push(newProject);
      }

      toast.success(`${createdProjects.length} project(s) created!`);
      onNext({ projects: createdProjects });
    } catch (error) {
      toast.error("Failed to create projects: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-3">
          <FolderKanban className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Create Your First Projects</h2>
        <p className="text-slate-600">
          Start organizing your work by creating projects. You can add more later!
        </p>
      </div>

      {/* Project Forms */}
      <div className="space-y-4">
        {projects.map((project, index) => (
          <div key={index} className="p-4 border border-slate-200 rounded-lg bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold text-slate-700">
                Project {index + 1}
              </Label>
              {projects.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeProject(index)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Project Name *</Label>
                  <Button
                    onClick={() => {
                      if (!project.name.trim()) {
                        toast.error("Please enter project name first");
                        return;
                      }
                      handleAISuggestions(index);
                    }}
                    variant="outline"
                    size="sm"
                    disabled={aiGenerating}
                    className="border-purple-200 hover:border-purple-300 hover:bg-purple-50"
                  >
                    {aiGenerating ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1 text-purple-600" />
                        Get AI Suggestion
                      </>
                    )}
                  </Button>
                </div>
                <Input
                  placeholder="e.g., Website Redesign, Mobile App Development"
                  value={project.name}
                  onChange={(e) => updateProject(index, 'name', e.target.value)}
                />
              </div>

              <div>
                <Label className="text-sm">Description</Label>
                <Textarea
                  placeholder="What's this project about?"
                  value={project.description}
                  onChange={(e) => updateProject(index, 'description', e.target.value)}
                  rows={2}
                />
              </div>

              <div>
                <Label className="text-sm">Priority</Label>
                <Select
                  value={project.priority}
                  onValueChange={(value) => updateProject(index, 'priority', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}

        {projects.length < 3 && (
          <Button
            onClick={addProject}
            variant="outline"
            className="w-full border-dashed"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Project
          </Button>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => onNext({ projects: [] })}>
            Skip
          </Button>
          <Button onClick={handleNext} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

