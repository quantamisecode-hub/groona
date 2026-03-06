import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Code, Megaphone, Check, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function CompanyTypeStep({ tenant, user, onNext }) {
  const [companyName, setCompanyName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [errors, setErrors] = useState({ companyName: false, workspaceName: false });

  const handleNext = () => {
    const newErrors = {
      companyName: !companyName.trim(),
      workspaceName: !workspaceName.trim()
    };

    setErrors(newErrors);

    if (newErrors.companyName || newErrors.workspaceName) {
      return;
    }

    onNext({
      company_type: "SOFTWARE",
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
          Set up your <span className="text-blue-600">workspace.</span>
        </h2>
        <p className="text-slate-500 text-xl max-w-2xl">
          Name your organization and create a dedicated workspace for your team's projects.
        </p>
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
            <div className="flex justify-between items-end mb-1">
              <Label htmlFor="companyName" className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
                Organization Name
              </Label>
              {errors.companyName && (
                <span className="text-[10px] font-bold uppercase text-red-500 mr-1">
                  Field required
                </span>
              )}
            </div>
            <Input
              id="companyName"
              placeholder="e.g. Acme Corp"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (errors.companyName) setErrors({ ...errors, companyName: false });
              }}
              className={`h-12 border-slate-200 focus:border-blue-600 focus:ring-blue-600 rounded-xl transition-all ${errors.companyName ? "border-red-500 ring-red-500/20" : ""
                }`}
            />
          </div>

          <div className="space-y-2 text-left">
            <div className="flex justify-between items-end mb-1">
              <Label htmlFor="workspaceName" className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
                Workspace Identifier
              </Label>
              {errors.workspaceName && (
                <span className="text-[10px] font-bold uppercase text-red-500 mr-1">
                  Field required
                </span>
              )}
            </div>
            <Input
              id="workspaceName"
              placeholder="e.g. General"
              value={workspaceName}
              onChange={(e) => {
                setWorkspaceName(e.target.value);
                if (errors.workspaceName) setErrors({ ...errors, workspaceName: false });
              }}
              className={`h-12 border-slate-200 focus:border-blue-600 focus:ring-blue-600 rounded-xl transition-all ${errors.workspaceName ? "border-red-500 ring-red-500/20" : ""
                }`}
            />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="pt-6 border-t border-slate-100 flex items-center justify-end"
      >
        <Button
          onClick={handleNext}
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-slate-900 border-0 hover:from-blue-700 hover:to-slate-950 text-white rounded-xl px-10 h-14 font-semibold group"
        >
          Continue
          <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </motion.div>
    </div>
  );
}