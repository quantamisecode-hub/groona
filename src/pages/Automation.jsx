import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Users, Repeat, Bell, FileText } from "lucide-react";
import AutoAssignment from "../components/automation/AutoAssignment";
import RecurringTasks from "../components/automation/RecurringTasks";
import AutoReminders from "../components/automation/AutoReminders";
import ProjectProposal from "../components/automation/ProjectProposal";

export default function Automation() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Automation</h1>
              <p className="text-slate-600">Automate repetitive project management tasks</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="auto-assign" className="space-y-6">
        <TabsList className="bg-white/60 backdrop-blur-xl border border-slate-200/60">
          <TabsTrigger value="auto-assign">
            <Users className="h-4 w-4 mr-2" />
            Auto-Assign
          </TabsTrigger>
          <TabsTrigger value="recurring">
            <Repeat className="h-4 w-4 mr-2" />
            Recurring Tasks
          </TabsTrigger>
          <TabsTrigger value="reminders">
            <Bell className="h-4 w-4 mr-2" />
            Reminders
          </TabsTrigger>
          <TabsTrigger value="proposals">
            <FileText className="h-4 w-4 mr-2" />
            Proposals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="auto-assign">
          <AutoAssignment currentUser={currentUser} />
        </TabsContent>

        <TabsContent value="recurring">
          <RecurringTasks currentUser={currentUser} />
        </TabsContent>

        <TabsContent value="reminders">
          <AutoReminders currentUser={currentUser} />
        </TabsContent>

        <TabsContent value="proposals">
          <ProjectProposal currentUser={currentUser} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

