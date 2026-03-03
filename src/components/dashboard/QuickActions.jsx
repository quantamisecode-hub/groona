import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Bot, FolderKanban } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function QuickActions() {
  return (
    <Card className="bg-white border border-slate-100 shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-800">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        <Link to={createPageUrl("Projects")} className="block">
          <Button className="w-full justify-start bg-gradient-to-r from-blue-600 to-slate-900 border-0 shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-slate-950 hover:opacity-90 hover:tracking-wide text-white font-bold transition-all active:scale-95">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
        <Link to={createPageUrl("AIAssistant")} className="block">
          <Button variant="outline" className="w-full justify-start border-slate-200 hover:bg-slate-50">
            <Bot className="h-4 w-4 mr-2" />
            Ask AI Assistant
          </Button>
        </Link>
        <Link to={createPageUrl("Projects")} className="block">
          <Button variant="outline" className="w-full justify-start border-slate-200 hover:bg-slate-50">
            <FolderKanban className="h-4 w-4 mr-2" />
            View All Projects
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
