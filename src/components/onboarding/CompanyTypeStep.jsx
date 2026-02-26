import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Code, Megaphone, Check, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function CompanyTypeStep({ tenant, user, onNext }) {
  const [selectedType, setSelectedType] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  const companyTypes = [
    {
      id: "SOFTWARE",
      icon: Code,
      title: "Software Development",
      description: "Agile workflows, sprints, and code reviews.",
      features: ["Sprints & Velocity", "Story Points", "Code Integration"]
    },
    {
      id: "MARKETING",
      icon: Megaphone,
      title: "Marketing Agency",
      description: "Campaigns, content pipelines, and creative assets.",
      features: ["Campaign Tracking", "Approval Flows", "Client Portals"]
    }
  ];

  const handleNext = () => {
    if (!selectedType || !companyName.trim() || !workspaceName.trim()) return;
    onNext({
      company_type: selectedType,
      company_name: companyName.trim(),
      workspace_name: workspaceName.trim()
    });
  };

  return (
    <div className="w-full space-y-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
          Tell us about your <span className="text-blue-600">organization.</span>
        </h2>
        <p className="text-slate-500 text-xl max-w-2xl">
          We'll customize your experience with the right tools and terminology for your industry.
        </p>
      </motion.div>

      {/* Simplified Selection Cards - Wider Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 xl:grid-cols-2 gap-6"
      >
        {companyTypes.map((type) => (
          <motion.button
            key={type.id}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedType(type.id)}
            className={`flex flex-col text-left p-6 rounded-2xl border-2 transition-all duration-200 relative overflow-hidden group ${selectedType === type.id
              ? "border-blue-600 bg-blue-50/30"
              : "border-slate-100 hover:border-slate-200 bg-white"
              }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${selectedType === type.id ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600"
              }`}>
              <type.icon className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-slate-900 mb-1">{type.title}</h3>
            <p className="text-sm text-slate-500 leading-snug mb-4">{type.description}</p>

            <ul className="space-y-2 mt-auto">
              {type.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <div className={`w-1 h-1 rounded-full ${selectedType === type.id ? "bg-blue-600" : "bg-slate-300"}`} />
                  {f}
                </li>
              ))}
            </ul>

            {selectedType === type.id && (
              <motion.div
                layoutId="active-selection"
                className="absolute top-4 right-4"
              >
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />
                </div>
              </motion.div>
            )}
          </motion.button>
        ))}
      </motion.div>

      {/* Form Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-6 pt-2"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2 text-left">
            <Label htmlFor="companyName" className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
              Organization Name
            </Label>
            <Input
              id="companyName"
              placeholder="e.g. Acme Corp"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="h-12 border-slate-200 focus:border-blue-600 focus:ring-blue-600 rounded-xl transition-all"
            />
          </div>

          <div className="space-y-2 text-left">
            <Label htmlFor="workspaceName" className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
              Workspace Identifier
            </Label>
            <Input
              id="workspaceName"
              placeholder="e.g. General"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="h-12 border-slate-200 focus:border-blue-600 focus:ring-blue-600 rounded-xl transition-all"
            />
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="pt-6 border-t border-slate-100 flex items-center justify-end"
      >
        <Button
          onClick={handleNext}
          disabled={!selectedType || !companyName.trim() || !workspaceName.trim()}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white px-10 h-14 font-semibold group"
        >
          Continue
          <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </motion.div>
    </div>
  );
}