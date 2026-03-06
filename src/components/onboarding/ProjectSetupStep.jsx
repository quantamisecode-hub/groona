import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderKanban, Plus, Trash2, Sparkles, Loader2, ArrowRight, Rocket } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function ProjectSetupStep({ tenant, user, onNext, onSkip, onBack }) {
  const defaultProjectState = {
    name: "",
    description: "",
    priority: "medium",
    enableFinancialTracking: false,
    billing_model: "time_and_materials",
    currency: "INR",
    estimated_duration: "",
    contract_amount: "",
    default_bill_rate_per_hour: "",
    retainer_amount: "",
    retainer_period: "month",
    contract_start_date: "",
    contract_end_date: "",
    non_billable_reason: "",
    expense_budget: ""
  };

  const [projects, setProjects] = useState([{ ...defaultProjectState }]);
  const [projectErrors, setProjectErrors] = useState([{}]);
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  const addProject = () => {
    if (projects.length < 3) {
      setProjects([...projects, { ...defaultProjectState }]);
      setProjectErrors([...projectErrors, {}]);
    }
  };

  const removeProject = (index) => {
    setProjects(projects.filter((_, i) => i !== index));
    setProjectErrors(projectErrors.filter((_, i) => i !== index));
  };

  const updateProject = (index, field, value) => {
    const updated = [...projects];
    updated[index][field] = value;
    setProjects(updated);

    // Clear error for this field
    if (projectErrors[index][field]) {
      const updatedErrors = [...projectErrors];
      updatedErrors[index] = { ...updatedErrors[index], [field]: false };
      setProjectErrors(updatedErrors);
    }
  };

  const handleAISuggestions = async (projectIndex = 0) => {
    // ... (rest of the handleAISuggestions logic remains the same)
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
    const newErrors = projects.map(project => {
      const errors = {};
      if (!project.name.trim()) errors.name = true;
      if (project.enableFinancialTracking && !String(project.expense_budget).trim()) errors.expense_budget = true;
      return errors;
    });

    setProjectErrors(newErrors);

    const hasErrors = newErrors.some(error => Object.values(error).includes(true));
    if (hasErrors) {
      toast.error("Please fill in all required fields");
      return;
    }

    const validProjects = projects.filter(p => p.name.trim());
    if (validProjects.length === 0) {
      toast.error("Please add at least one project or skip this step");
      return;
    }

    setLoading(true);
    try {
      const createdProjects = [];
      for (const project of validProjects) {
        // Handle financial fields mapping if tracking is enabled
        let billingFields = {};
        if (project.enableFinancialTracking) {
          switch (project.billing_model) {
            case "time_and_materials":
              billingFields = {
                estimated_duration: Number(project.estimated_duration) || 0,
                default_bill_rate_per_hour: Number(project.default_bill_rate_per_hour) || 0,
                contract_amount: 0,
                budget: 0,
                retainer_amount: 0,
                retainer_period: null,
                non_billable_reason: null,
                contract_start_date: null,
                contract_end_date: null,
              };
              break;
            case "fixed_price":
              billingFields = {
                contract_amount: Number(project.contract_amount) || 0,
                budget: Number(project.contract_amount) || 0,
                contract_start_date: project.contract_start_date || undefined,
                contract_end_date: project.contract_end_date || undefined,
                estimated_duration: 0,
                default_bill_rate_per_hour: 0,
                retainer_amount: 0,
                retainer_period: null,
                non_billable_reason: null,
              };
              break;
            case "retainer":
              billingFields = {
                retainer_amount: Number(project.retainer_amount) || 0,
                retainer_period: project.retainer_period || "month",
                contract_start_date: project.contract_start_date || undefined,
                contract_end_date: project.contract_end_date || undefined,
                contract_amount: 0,
                budget: 0,
                estimated_duration: 0,
                default_bill_rate_per_hour: 0,
                non_billable_reason: null,
              };
              break;
            case "non_billable":
              billingFields = {
                non_billable_reason: project.non_billable_reason?.trim() || undefined,
                contract_amount: 0,
                budget: 0,
                estimated_duration: 0,
                default_bill_rate_per_hour: 0,
                retainer_amount: 0,
                retainer_period: null,
                contract_start_date: null,
                contract_end_date: null,
              };
              break;
            default:
              break;
          }
        }

        const newProject = await groonabackend.entities.Project.create({
          tenant_id: tenant.id,
          name: project.name.trim(),
          description: project.description.trim(),
          priority: project.priority,
          status: "planning",
          owner: user.email,
          progress: 0,
          ...(project.enableFinancialTracking ? {
            billing_model: project.billing_model,
            currency: project.currency,
            expense_budget: Number(project.expense_budget) || 0,
            ...billingFields
          } : {})
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
    <div className="w-full space-y-12">
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">Focus on your goals.</h2>
        <p className="text-slate-500 text-xl max-w-2xl">Define your initial projects to get your workspace moving. You can always refine these later.</p>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          <AnimatePresence>
            {projects.map((project, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-6 rounded-2xl border border-slate-100 bg-white ring-8 ring-slate-50/50"
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-600">Project {index + 1}</span>
                  {projects.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeProject(index)} className="h-8 w-8 text-slate-300 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className={`text-xs font-bold uppercase ml-1 ${projectErrors[index]?.name ? "text-red-500" : "text-slate-400"}`}>
                        Title {projectErrors[index]?.name && <span className="ml-1">— Required</span>}
                      </Label>
                      <button
                        onClick={() => handleAISuggestions(index)}
                        className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50 transition-colors disabled:opacity-50"
                        disabled={aiGenerating}
                      >
                        {aiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        Use AI
                      </button>
                    </div>
                    <Input
                      placeholder="e.g. Q1 Product Roadmap"
                      value={project.name}
                      onChange={(e) => updateProject(index, 'name', e.target.value)}
                      className={`h-12 border-slate-100 focus:border-blue-600 rounded-xl transition-all ${projectErrors[index]?.name ? "border-red-500 ring-red-500/20" : ""
                        }`}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400 ml-1">Details</Label>
                    <Textarea
                      placeholder="Briefly describe the objectives..."
                      value={project.description}
                      onChange={(e) => updateProject(index, 'description', e.target.value)}
                      rows={2}
                      className="border-slate-100 focus:border-blue-600 rounded-xl resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-2">
                      <Label className="text-xs font-bold uppercase text-slate-400 ml-1">Priority</Label>
                      <Select value={project.priority} onValueChange={(v) => updateProject(index, 'priority', v)}>
                        <SelectTrigger className="h-10 border-slate-100 rounded-xl">
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

                  {/* Financial Tracking Section */}
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`financial-tracking-${index}`}
                        checked={project.enableFinancialTracking}
                        onCheckedChange={(checked) => updateProject(index, 'enableFinancialTracking', checked)}
                      />
                      <Label htmlFor={`financial-tracking-${index}`} className="font-medium cursor-pointer text-sm text-slate-700">
                        Enable Financial Tracking
                      </Label>
                    </div>

                    {project.enableFinancialTracking && (
                      <div className="grid md:grid-cols-2 gap-x-4 gap-y-4 pt-2 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-500">Billing Model</Label>
                          <Select
                            value={project.billing_model}
                            onValueChange={(v) => updateProject(index, 'billing_model', v)}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="time_and_materials">Time & Materials</SelectItem>
                              <SelectItem value="fixed_price">Fixed Price</SelectItem>
                              <SelectItem value="retainer">Retainer</SelectItem>
                              <SelectItem value="non_billable">Non-Billable</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-500">Currency</Label>
                          <Select
                            value={project.currency}
                            onValueChange={(v) => updateProject(index, 'currency', v)}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="INR">INR (₹)</SelectItem>
                              <SelectItem value="USD">USD ($)</SelectItem>
                              <SelectItem value="EUR">EUR (€)</SelectItem>
                              <SelectItem value="GBP">GBP (£)</SelectItem>
                              <SelectItem value="AUD">AUD (A$)</SelectItem>
                              <SelectItem value="CAD">CAD (C$)</SelectItem>
                              <SelectItem value="SGD">SGD (S$)</SelectItem>
                              <SelectItem value="AED">AED (dh)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Fixed Price Specifics */}
                        {project.billing_model === "fixed_price" && (
                          <>
                            <div className="col-span-2 space-y-2">
                              <Label className="text-xs font-bold text-slate-500">Fixed Price Amount *</Label>
                              <Input
                                type="number"
                                min="0"
                                value={project.contract_amount}
                                onChange={(e) => updateProject(index, 'contract_amount', e.target.value)}
                                placeholder="0.00"
                                className="bg-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-slate-500">Start Date *</Label>
                              <Input
                                type="date"
                                value={project.contract_start_date}
                                onChange={(e) => updateProject(index, 'contract_start_date', e.target.value)}
                                className="bg-white text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-slate-500">End Date *</Label>
                              <Input
                                type="date"
                                value={project.contract_end_date}
                                onChange={(e) => updateProject(index, 'contract_end_date', e.target.value)}
                                className="bg-white text-sm"
                              />
                            </div>
                          </>
                        )}

                        {/* Time & Materials Specifics */}
                        {project.billing_model === "time_and_materials" && (
                          <>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-slate-500">Duration (hours) *</Label>
                              <Input
                                type="number"
                                min="0"
                                value={project.estimated_duration}
                                onChange={(e) => updateProject(index, 'estimated_duration', e.target.value)}
                                placeholder="e.g. 120"
                                className="bg-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-slate-500">Bill Rate/Hr</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={project.default_bill_rate_per_hour}
                                onChange={(e) => updateProject(index, 'default_bill_rate_per_hour', e.target.value)}
                                placeholder="0.00"
                                className="bg-white"
                              />
                            </div>
                          </>
                        )}

                        {/* Retainer Specifics */}
                        {project.billing_model === "retainer" && (
                          <>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-slate-500">Retainer Amount *</Label>
                              <Input
                                type="number"
                                min="0"
                                value={project.retainer_amount}
                                onChange={(e) => updateProject(index, 'retainer_amount', e.target.value)}
                                placeholder="0.00"
                                className="bg-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-slate-500">Period</Label>
                              <Select
                                value={project.retainer_period}
                                onValueChange={(v) => updateProject(index, 'retainer_period', v)}
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="month">Monthly</SelectItem>
                                  <SelectItem value="quarter">Quarterly</SelectItem>
                                  <SelectItem value="year">Yearly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-slate-500">Start Date *</Label>
                              <Input
                                type="date"
                                value={project.contract_start_date}
                                onChange={(e) => updateProject(index, 'contract_start_date', e.target.value)}
                                className="bg-white text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-slate-500">End Date *</Label>
                              <Input
                                type="date"
                                value={project.contract_end_date}
                                onChange={(e) => updateProject(index, 'contract_end_date', e.target.value)}
                                className="bg-white text-sm"
                              />
                            </div>
                          </>
                        )}

                        {/* Non-Billable Specifics */}
                        {project.billing_model === "non_billable" && (
                          <div className="col-span-2 space-y-2">
                            <Label className="text-xs font-bold text-slate-500">Reason *</Label>
                            <Input
                              value={project.non_billable_reason}
                              onChange={(e) => updateProject(index, 'non_billable_reason', e.target.value)}
                              placeholder="e.g. Internal tools, Proof of concept"
                              className="bg-white"
                            />
                          </div>
                        )}

                        {/* Expense Budget - Common Field */}
                        <div className="col-span-2 space-y-2 pt-2 border-t border-slate-200/50">
                          <Label className={`text-xs font-bold flex items-center justify-between ${projectErrors[index]?.expense_budget ? "text-red-500" : "text-slate-500"}`}>
                            Expense Budget
                            <span className={`text-[10px] uppercase font-medium tracking-wide ${projectErrors[index]?.expense_budget ? "text-red-500" : "text-slate-400"}`}>
                              {projectErrors[index]?.expense_budget ? "Required" : "Required"}
                            </span>
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            value={project.expense_budget}
                            onChange={(e) => updateProject(index, 'expense_budget', e.target.value)}
                            placeholder="0.00"
                            className={`bg-white transition-all ${projectErrors[index]?.expense_budget ? "border-red-500 ring-red-500/20" : ""
                              }`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {projects.length < 3 && (
            <Button onClick={addProject} variant="outline" className="w-full h-14 rounded-2xl border-dashed border-2 border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 text-slate-400 transition-all font-bold">
              <Plus className="w-4 h-4 mr-2" />
              Add another mission
            </Button>
          )}
        </motion.div>

        {/* Project Tips Column */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-8 lg:sticky lg:top-0"
        >
          <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 space-y-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-slate-900 text-lg">Pro Planning Tips</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Successful teams usually start with 2-3 focused projects. This helps maintain momentum without overwhelming the initial team.
              </p>
            </div>
            <ul className="space-y-4">
              {[
                "Keep titles short and action-oriented",
                "Define a clear 'Done' state in the details",
                "Use high priority for bottleneck projects",
                "Leverage AI for drafting descriptions"
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-6 rounded-2xl border border-blue-50 bg-blue-50/20 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Rocket className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-blue-800 leading-snug">
              Projects can be grouped into Workspace Folders later for even better organization.
            </p>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="pt-8 border-t border-slate-100 flex items-center justify-end"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => onNext({ projects: [] })} className="text-slate-400 hover:text-slate-900 font-bold">
            Skip for now
          </Button>
          <Button
            onClick={handleNext}
            disabled={loading}
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-slate-900 border-0 hover:from-blue-700 hover:to-slate-950 text-white rounded-xl px-10 h-14 font-bold group min-w-[140px]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Save & Continue <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

