import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Rocket, 
  Megaphone, 
  Building, 
  FlaskConical, 
  PartyPopper,
  Package,
  FileText,
  Edit,
  Trash2,
  Copy
} from "lucide-react";
import CreateTemplateDialog from "./CreateTemplateDialog";
import { toast } from "sonner";

const categoryIcons = {
  software_development: Rocket,
  marketing: Megaphone,
  construction: Building,
  research: FlaskConical,
  event: PartyPopper,
  product_launch: Package,
  custom: FileText,
};

const categoryColors = {
  software_development: "from-blue-500 to-cyan-500",
  marketing: "from-pink-500 to-rose-500",
  construction: "from-orange-500 to-amber-500",
  research: "from-purple-500 to-indigo-500",
  event: "from-green-500 to-emerald-500",
  product_launch: "from-red-500 to-orange-500",
  custom: "from-slate-500 to-gray-500",
};

export default function ProjectTemplates({ onSelectTemplate, showCreateButton = true }) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['project-templates'],
    queryFn: () => groonabackend.entities.ProjectTemplate.list('-usage_count'),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id) => groonabackend.entities.ProjectTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-templates'] });
      toast.success('Template deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete template');
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: async (template) => {
      const newTemplate = {
        ...template,
        name: `${template.name} (Copy)`,
        usage_count: 0,
      };
      delete newTemplate.id;
      delete newTemplate.created_date;
      delete newTemplate.updated_date;
      return groonabackend.entities.ProjectTemplate.create(newTemplate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-templates'] });
      toast.success('Template duplicated successfully');
    },
    onError: () => {
      toast.error('Failed to duplicate template');
    },
  });

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setShowCreateDialog(true);
  };

  const handleDeleteTemplate = (templateId) => {
    if (confirm('Are you sure you want to delete this template?')) {
      deleteTemplateMutation.mutate(templateId);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 bg-white/60 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Project Templates</h2>
            <p className="text-sm text-slate-600">Start projects faster with predefined templates</p>
          </div>
          {showCreateButton && (
            <Button
              onClick={() => {
                setEditingTemplate(null);
                setShowCreateDialog(true);
              }}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => {
            const Icon = categoryIcons[template.category] || FileText;
            const gradientClass = categoryColors[template.category] || categoryColors.custom;
            
            return (
              <Card 
                key={template.id}
                className="bg-white/60 backdrop-blur-xl border-slate-200/60 hover:shadow-lg transition-all duration-300 cursor-pointer group"
                onClick={() => onSelectTemplate && onSelectTemplate(template)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${gradientClass} shadow-lg flex-shrink-0`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTemplate(template);
                        }}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateTemplateMutation.mutate(template);
                        }}
                        className="h-8 w-8"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(template.id);
                        }}
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-lg mt-3">{template.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-600 line-clamp-2">
                    {template.description || 'No description provided'}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>{template.task_templates?.length || 0} tasks</span>
                    {template.estimated_duration_days && (
                      <span>{template.estimated_duration_days} days</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {template.category.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Used {template.usage_count || 0}x
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <CreateTemplateDialog
        open={showCreateDialog}
        onClose={() => {
          setShowCreateDialog(false);
          setEditingTemplate(null);
        }}
        template={editingTemplate}
      />
    </>
  );
}

