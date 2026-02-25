import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, Info, Zap, Clock, Users, Target } from "lucide-react";

export default function EnhancedWorkSetupStep({ data, tenant, onNext, onBack }) {
  const [formData, setFormData] = useState({
    use_cases: data.work_setup?.use_cases || [],
    enable_sprints: data.work_setup?.enable_sprints ?? true,
    enable_timesheets: data.work_setup?.enable_timesheets ?? true,
  });

  // Determine use cases based on company type
  const useCaseOptions = tenant?.company_type === 'MARKETING'
    ? [
        { id: 'campaigns', icon: Target, title: 'Campaign Management', desc: 'Plan and execute marketing campaigns' },
        { id: 'content', icon: Zap, title: 'Content Creation', desc: 'Manage content workflows' },
        { id: 'analytics', icon: Users, title: 'Analytics Tracking', desc: 'Monitor campaign performance' }
      ]
    : [
        { id: 'development', icon: Zap, title: 'Software Development', desc: 'Build and ship features' },
        { id: 'bug_tracking', icon: Target, title: 'Bug Tracking', desc: 'Track and resolve issues' },
        { id: 'team_collaboration', icon: Users, title: 'Team Collaboration', desc: 'Work together seamlessly' }
      ];

  const toggleUseCase = (id) => {
    if (formData.use_cases.includes(id)) {
      setFormData({
        ...formData,
        use_cases: formData.use_cases.filter(uc => uc !== id)
      });
    } else {
      setFormData({
        ...formData,
        use_cases: [...formData.use_cases, id]
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.use_cases.length === 0) {
      return;
    }
    onNext(formData);
  };

  // Get plan-specific recommendations
  const maxProjects = tenant?.max_projects || 10;
  const maxUsers = tenant?.max_users || 5;
  const hasAI = tenant?.features_enabled?.ai_assistant;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          How will you use Aivora?
        </h2>
        <p className="text-slate-600">
          Select your primary use cases to customize your workspace
        </p>
      </div>

      {/* Plan Context Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900 text-sm">
          Your plan includes <strong>{maxUsers} users</strong>, <strong>{maxProjects} projects</strong>
          {hasAI && <>, and <strong>AI Assistant</strong></>}. Configure features to match your workflow.
        </AlertDescription>
      </Alert>

      {/* Use Cases */}
      <div className="space-y-3">
        <Label>Primary Use Cases *</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {useCaseOptions.map((useCase) => {
            const Icon = useCase.icon;
            const isSelected = formData.use_cases.includes(useCase.id);

            return (
              <Card
                key={useCase.id}
                className={`cursor-pointer transition-all p-4 ${
                  isSelected
                    ? 'ring-2 ring-blue-500 bg-blue-50'
                    : 'hover:shadow-md hover:border-blue-200'
                }`}
                onClick={() => toggleUseCase(useCase.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Icon className="h-5 w-5 text-blue-600" />
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">{useCase.title}</h3>
                <p className="text-xs text-slate-600">{useCase.desc}</p>
              </Card>
            );
          })}
        </div>
        {formData.use_cases.length === 0 && (
          <p className="text-sm text-red-600">Please select at least one use case</p>
        )}
      </div>

      {/* Feature Toggles */}
      <div className="space-y-3">
        <Label>Features</Label>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Zap className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium text-slate-900">
                  {tenant?.company_type === 'MARKETING' ? 'Campaigns' : 'Sprints'}
                </h4>
                <p className="text-sm text-slate-600">
                  {tenant?.company_type === 'MARKETING' 
                    ? 'Organize work in time-boxed campaigns'
                    : 'Use agile sprints for iterative development'}
                </p>
              </div>
            </div>
            <Switch
              checked={formData.enable_sprints}
              onCheckedChange={(checked) => setFormData({ ...formData, enable_sprints: checked })}
            />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-slate-900">Time Tracking</h4>
                <p className="text-sm text-slate-600">Track hours and manage timesheets</p>
              </div>
            </div>
            <Switch
              checked={formData.enable_timesheets}
              onCheckedChange={(checked) => setFormData({ ...formData, enable_timesheets: checked })}
            />
          </div>
        </Card>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          type="submit"
          className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          disabled={formData.use_cases.length === 0}
        >
          Continue
        </Button>
      </div>
    </form>
  );
}