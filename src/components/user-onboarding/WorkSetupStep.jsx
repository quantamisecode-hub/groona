import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, Check } from "lucide-react";

export default function WorkSetupStep({ data, tenant, onNext }) {
  const [formData, setFormData] = useState({
    use_cases: data.work_setup?.use_cases || [],
    enable_sprints: data.work_setup?.enable_sprints ?? (tenant?.company_type !== 'MARKETING'),
    enable_timesheets: data.work_setup?.enable_timesheets ?? true
  });

  const useCaseOptions = tenant?.company_type === 'MARKETING' 
    ? [
        { id: 'client_projects', label: 'Client Projects', description: 'Manage client campaigns and deliverables' },
        { id: 'campaign_management', label: 'Campaign Management', description: 'Plan and track marketing campaigns' },
        { id: 'content_creation', label: 'Content Creation', description: 'Manage content production workflows' },
        { id: 'internal_operations', label: 'Internal Operations', description: 'Track internal team activities' }
      ]
    : [
        { id: 'agile_scrum', label: 'Agile / Scrum Projects', description: 'Sprint-based software development' },
        { id: 'client_projects', label: 'Client Projects', description: 'External client deliverables' },
        { id: 'internal_operations', label: 'Internal Operations', description: 'Internal tools and processes' },
        { id: 'product_development', label: 'Product Development', description: 'Build and ship products' }
      ];

  const toggleUseCase = (useCaseId) => {
    setFormData(prev => ({
      ...prev,
      use_cases: prev.use_cases.includes(useCaseId)
        ? prev.use_cases.filter(id => id !== useCaseId)
        : [...prev.use_cases, useCaseId]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.use_cases.length > 0) {
      onNext(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          How will you use Aivora?
        </h2>
        <p className="text-slate-600">
          Select all that apply - we'll configure your workspace accordingly
        </p>
      </div>

      {/* Use Cases */}
      <div className="space-y-3">
        <Label>Primary Use Cases *</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {useCaseOptions.map((useCase) => {
            const isSelected = formData.use_cases.includes(useCase.id);
            
            return (
              <Card
                key={useCase.id}
                className={`cursor-pointer p-4 transition-all ${
                  isSelected
                    ? 'ring-2 ring-blue-500 bg-blue-50'
                    : 'hover:shadow-md hover:border-blue-200'
                }`}
                onClick={() => toggleUseCase(useCase.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleUseCase(useCase.id)}
                    />
                    <div>
                      <h4 className="font-medium text-slate-900">{useCase.label}</h4>
                      <p className="text-sm text-slate-600 mt-1">{useCase.description}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="h-5 w-5 text-blue-600" />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Feature Toggles */}
      <div className="space-y-4 pt-4 border-t">
        <Label>Features</Label>
        
        <Card
          className={`cursor-pointer p-4 transition-all ${
            formData.enable_sprints
              ? 'ring-2 ring-blue-500 bg-blue-50'
              : 'hover:shadow-md'
          }`}
          onClick={() => setFormData({ ...formData, enable_sprints: !formData.enable_sprints })}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <h4 className="font-medium text-slate-900">
                  Enable {tenant?.company_type === 'MARKETING' ? 'Campaigns' : 'Sprints'}
                </h4>
                <p className="text-sm text-slate-600">
                  {tenant?.company_type === 'MARKETING' 
                    ? 'Plan and track marketing campaigns'
                    : 'Time-boxed iterations for project work'
                  }
                </p>
              </div>
            </div>
            <Checkbox
              checked={formData.enable_sprints}
              onCheckedChange={(checked) => setFormData({ ...formData, enable_sprints: checked })}
            />
          </div>
        </Card>

        <Card
          className={`cursor-pointer p-4 transition-all ${
            formData.enable_timesheets
              ? 'ring-2 ring-blue-500 bg-blue-50'
              : 'hover:shadow-md'
          }`}
          onClick={() => setFormData({ ...formData, enable_timesheets: !formData.enable_timesheets })}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <h4 className="font-medium text-slate-900">Enable Timesheets</h4>
                <p className="text-sm text-slate-600">
                  Track time spent on tasks and projects
                </p>
              </div>
            </div>
            <Checkbox
              checked={formData.enable_timesheets}
              onCheckedChange={(checked) => setFormData({ ...formData, enable_timesheets: checked })}
            />
          </div>
        </Card>
      </div>

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
        size="lg"
        disabled={formData.use_cases.length === 0}
      >
        Continue
      </Button>
    </form>
  );
}