import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';

export default function OnboardingChecklist({ 
  items = [], // <--- FIX: Added default empty array to prevent crash
  progress, 
  onRestartOnboarding,
  className = '' 
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Safe check for progress existence
  const completedCount = Object.values(progress?.checklist_items || {}).filter(Boolean).length;
  const totalCount = items.length;
  const percentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isComplete = totalCount > 0 && completedCount === totalCount;

  return (
    <Card className={`${className} ${isComplete ? 'border-green-500 bg-green-50/50' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {isComplete ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Onboarding Complete! 🎉</span>
                </>
              ) : (
                <>
                  Getting Started
                  <span className="text-sm font-normal text-slate-500">
                    ({completedCount}/{totalCount})
                  </span>
                </>
              )}
            </CardTitle>
            <Progress value={percentage} className="mt-2 h-2" />
          </div>
          
          <div className="flex gap-2 ml-4">
            {isComplete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRestartOnboarding}
                className="text-slate-600"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restart
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="space-y-2">
              {items.length === 0 ? (
                <p className="text-sm text-slate-500 p-2">No steps available.</p>
              ) : (
                items.map((item) => {
                  const isCompleted = progress?.checklist_items?.[item.id];
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        isCompleted 
                          ? 'bg-green-50 text-green-900' 
                          : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-400 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isCompleted ? 'line-through' : ''}`}>
                          {item.label}
                        </p>
                        {!isCompleted && item.hint && (
                          <p className="text-xs text-slate-500 mt-0.5">{item.hint}</p>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}