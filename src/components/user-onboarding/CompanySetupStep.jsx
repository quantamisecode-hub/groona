import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Code, Megaphone, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CompanySetupStep({ data, onNext }) {
  const [formData, setFormData] = useState({
    company_name: data.company_setup?.company_name || '',
    workspace_name: data.company_setup?.workspace_name || '',
    company_type: data.company_setup?.company_type || '',
    team_size: data.company_setup?.team_size || ''
  });

  const companyTypes = [
    {
      id: 'SOFTWARE',
      icon: Code,
      title: 'Software Development',
      description: 'Agile workflows, sprints, and developer tools'
    },
    {
      id: 'MARKETING',
      icon: Megaphone,
      title: 'Marketing Agency',
      description: 'Campaign management and content workflows'
    }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.company_name && formData.workspace_name && formData.company_type && formData.team_size) {
      onNext(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Tell us about your company
        </h2>
        <p className="text-slate-600">
          We'll customize your workspace to fit your needs
        </p>
      </div>

      {/* Company Name */}
      <div className="space-y-2">
        <Label htmlFor="company_name">Company Name *</Label>
        <Input
          id="company_name"
          value={formData.company_name}
          onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
          placeholder="Enter your company name"
          className="text-lg"
          required
        />
      </div>

      {/* Workspace Name */}
      <div className="space-y-2">
        <Label htmlFor="workspace_name">Workspace Name *</Label>
        <Input
          id="workspace_name"
          value={formData.workspace_name}
          onChange={(e) => setFormData({ ...formData, workspace_name: e.target.value })}
          placeholder="Enter your workspace name"
          className="text-lg"
          required
        />
      </div>

      {/* Company Type */}
      <div className="space-y-3">
        <Label>What type of company are you? *</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {companyTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = formData.company_type === type.id;
            
            return (
              <Card
                key={type.id}
                className={`cursor-pointer p-4 transition-all ${
                  isSelected
                    ? 'ring-2 ring-blue-500 bg-blue-50'
                    : 'hover:shadow-md hover:border-blue-200'
                }`}
                onClick={() => setFormData({ ...formData, company_type: type.id })}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      type.id === 'MARKETING' ? 'bg-purple-100' : 'bg-blue-100'
                    }`}>
                      <Icon className={`h-5 w-5 ${
                        type.id === 'MARKETING' ? 'text-purple-600' : 'text-blue-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{type.title}</h3>
                      <p className="text-sm text-slate-600 mt-1">{type.description}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Team Size */}
      <div className="space-y-2">
        <Label htmlFor="team_size">Team Size *</Label>
        <Select
          value={formData.team_size}
          onValueChange={(value) => setFormData({ ...formData, team_size: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select your team size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1-5">1-5 people</SelectItem>
            <SelectItem value="6-20">6-20 people</SelectItem>
            <SelectItem value="21-50">21-50 people</SelectItem>
            <SelectItem value="50+">50+ people</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
        size="lg"
        disabled={!formData.company_name || !formData.workspace_name || !formData.company_type || !formData.team_size}
      >
        Continue
      </Button>
    </form>
  );
}