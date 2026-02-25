import React from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  FileText, 
  Plus, 
  AlertCircle, 
  TrendingUp, 
  Calendar,
  Users,
  Target,
  Sparkles
} from 'lucide-react';
import { cn } from "@/lib/utils";

const iconMap = {
  FileText,
  Plus,
  AlertCircle,
  TrendingUp,
  Calendar,
  Users,
  Target,
  Sparkles
};

export default function ConversationSuggestions({ suggestions = [], onSelect, className }) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider px-1">
        Suggested Questions
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {suggestions.map((suggestion, idx) => {
          const Icon = iconMap[suggestion.icon] || Sparkles;
          
          return (
            <Button
              key={idx}
              variant="outline"
              onClick={() => onSelect(suggestion.text)}
              className={cn(
                "justify-start h-auto py-3 px-4 text-left hover:bg-blue-50 hover:border-blue-300 transition-all",
                "group"
              )}
            >
              <div className="flex items-start gap-3 w-full">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center flex-shrink-0 group-hover:from-blue-200 group-hover:to-purple-200 transition-colors">
                  <Icon className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                    {suggestion.text}
                  </div>
                  {suggestion.description && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      {suggestion.description}
                    </div>
                  )}
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
