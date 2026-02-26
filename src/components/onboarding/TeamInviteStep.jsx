import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Mail, ArrowRight, Users, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function TeamInviteStep({ tenant, onNext, onBack }) {
  const [invites, setInvites] = useState([
    { email: "", role: "user" },
  ]);

  const addInvite = () => {
    const maxUsers = tenant?.max_users || 10;
    if (invites.length < maxUsers - 1) {
      setInvites([...invites, { email: "", role: "user" }]);
    } else {
      toast.error("User limit reached for your current plan.");
    }
  };

  const removeInvite = (index) => {
    setInvites(invites.filter((_, i) => i !== index));
  };

  const setInviteData = (index, field, value) => {
    const updated = [...invites];
    updated[index][field] = value;
    setInvites(updated);
  };

  const handleNext = () => {
    const validInvites = invites.filter(i => i.email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email));
    onNext({ invites: validInvites });
  };

  const currentUserCount = 1;
  const potentialCount = currentUserCount + invites.filter(i => i.email.trim()).length;
  const maxUsers = tenant?.max_users || 10;

  return (
    <div className="w-full space-y-12">
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight text-left">
          Invite your <span className="text-blue-600">partners.</span>
        </h2>
        <p className="text-slate-500 text-xl max-w-2xl text-left">
          Work is more effective when shared. Invite your core team members to begin collaborating on your new projects.
        </p>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-8"
        >
          {/* Modern Usage Indicator */}
          <div className="space-y-4 p-6 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-500">
              <span>Seats Occupied</span>
              <span>{potentialCount} / {maxUsers}</span>
            </div>
            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(potentialCount / maxUsers) * 100}%` }}
                className="h-full bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.4)]"
              />
            </div>
          </div>

          {/* Invite Rows */}
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {invites.map((invite, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="group flex flex-col sm:flex-row gap-4 p-6 rounded-2xl border border-slate-100 bg-white hover:border-blue-100 hover:shadow-md transition-all relative"
                >
                  <div className="flex-1 space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none group-hover:text-blue-500 transition-colors" />
                      <Input
                        type="email"
                        placeholder="name@company.com"
                        value={invite.email}
                        onChange={(e) => setInviteData(index, 'email', e.target.value)}
                        className="h-12 pl-11 border-slate-100 focus:border-blue-600 rounded-xl transition-all"
                      />
                    </div>
                  </div>

                  <div className="w-full sm:w-44 space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Role</Label>
                    <Select
                      value={invite.role}
                      onValueChange={(value) => setInviteData(index, 'role', value)}
                    >
                      <SelectTrigger className="h-12 border-slate-100 focus:border-blue-600 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Collaborator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {invites.length > 1 && (
                    <div className="flex items-end pb-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeInvite(index)}
                        className="h-10 w-10 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {potentialCount < maxUsers && (
              <Button
                onClick={addInvite}
                variant="outline"
                className="w-full h-14 rounded-2xl border-dashed border-2 border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 text-slate-400 transition-all font-bold"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add team member
              </Button>
            )}
          </div>
        </motion.div>

        {/* Informational Column */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6 lg:sticky lg:top-8"
        >
          <div className="p-8 rounded-3xl bg-blue-600 text-white space-y-6 relative overflow-hidden shadow-2xl shadow-blue-500/20">
            <div className="relative z-10 w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div className="relative z-10 space-y-3">
              <h3 className="font-bold text-xl">Collaborative First</h3>
              <p className="text-blue-100 text-sm leading-relaxed">
                Groona is designed for real-time partnership. Inviting your team now allows them to Participate in project planning from day one.
              </p>
            </div>
            <ul className="relative z-10 space-y-3 pt-6 border-t border-white/20">
              {[
                "Default role: Collaborator (can edit tasks)",
                "Admins: Full control over billing & settings",
                "Invite links are valid for 7 days"
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-3 text-xs text-blue-50 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-blue-200 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>

            {/* Decorative elements */}
            <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          </div>

          <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-600 italic">
              You can manage permissions and add custom roles later in Workspace Settings.
            </p>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="pt-8 border-t border-slate-100 flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => onNext({ invites: [] })} className="text-slate-400 hover:text-slate-900 font-bold">
            Skip for now
          </Button>
          <Button
            onClick={handleNext}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-12 h-14 font-bold group flex items-center gap-2"
          >
            Continue
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}