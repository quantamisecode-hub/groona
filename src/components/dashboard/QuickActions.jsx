import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Bot, FolderKanban } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function QuickActions() {
  return (
    <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-slate-900">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Link to={createPageUrl("Projects")} className="block">
          <Button className="w-full justify-start bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/20">
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
