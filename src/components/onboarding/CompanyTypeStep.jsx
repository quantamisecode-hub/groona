import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Code, Megaphone, Check } from "lucide-react";

export default function CompanyTypeStep({ tenant, user, onNext }) {
  const [selectedType, setSelectedType] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  const companyTypes = [
    {
      id: "SOFTWARE",
      icon: Code,
      title: "Software Development",
      description: "Agile workflows, sprints, story points, and developer tools",
      features: [
        "Sprint planning & velocity tracking",
        "Story points & burndown charts",
        "Code review integration",
        "Developer-focused analytics"
      ],
      color: "from-blue-500 to-cyan-500"
    },
    {
      id: "MARKETING",
      icon: Megaphone,
      title: "Marketing Agency",
      description: "Campaign management, content pipelines, and client deliverables",
      features: [
        "Campaign planning & tracking",
        "Content approval workflows",
        "Client collaboration tools",
        "Campaign performance metrics"
      ],
      color: "from-purple-500 to-pink-500"
    }
  ];

  const handleSelect = (type) => {
    setSelectedType(type);
  };

  const handleNext = () => {
    // Validate required fields
    if (!selectedType) {
      return;
    }
    if (!companyName.trim()) {
      return;
    }
    if (!workspaceName.trim()) {
      return;
    }
    
    onNext({ 
      company_type: selectedType,
      company_name: companyName.trim(),
      workspace_name: workspaceName.trim()
    });
  };

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="text-center space-y-3">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
          What type of company are you?
        </h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          We'll customize your workspace with the right tools and terminology for your industry
        </p>
      </div>

      {/* Company Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
        {companyTypes.map((type) => (
          <Card
            key={type.id}
            className={`cursor-pointer transition-all ${
              selectedType === type.id
                ? "ring-2 ring-blue-500 shadow-lg scale-105"
                : "hover:shadow-md hover:scale-102"
            }`}
            onClick={() => handleSelect(type.id)}
          >
            <CardContent className="p-6 space-y-4">
              {/* Icon & Title */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${type.color} flex items-center justify-center`}>
                    <type.icon className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{type.title}</h3>
                    <p className="text-sm text-slate-600 mt-1">{type.description}</p>
                  </div>
                </div>
                
                {selectedType === type.id && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <Check className="h-5 w-5 text-white" />
                    </div>
                  </div>
                )}
              </div>

              {/* Features List */}
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Included Features
                </p>
                <ul className="space-y-2">
                  {type.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Company Name and Workspace Name Inputs */}
      <div className="space-y-4 pt-4 max-w-2xl mx-auto">
        <div className="space-y-2">
          <Label htmlFor="companyName" className="text-sm font-semibold">
            Company Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="companyName"
            placeholder="Enter your company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            className="w-full"
          />
          <p className="text-xs text-slate-500">
            This will be your organization name
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="workspaceName" className="text-sm font-semibold">
            Workspace Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="workspaceName"
            placeholder="Enter your workspace name"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            required
            className="w-full"
          />
          <p className="text-xs text-slate-500">
            Give your workspace a name to help organize your projects and team
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-3 pt-4">
        <Button
          onClick={handleNext}
          disabled={!selectedType || !companyName.trim() || !workspaceName.trim()}
          size="lg"
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8"
        >
          Continue with {selectedType === "SOFTWARE" ? "Software Development" : selectedType === "MARKETING" ? "Marketing Agency" : "Selected Option"}
        </Button>
      </div>
    </div>
  );
}