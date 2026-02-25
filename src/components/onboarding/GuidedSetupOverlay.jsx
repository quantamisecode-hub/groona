import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function GuidedSetupOverlay({ 
  steps, 
  currentStep, 
  onNext, 
  onSkip, 
  onComplete 
}) {
  const [highlightElement, setHighlightElement] = useState(null);

  const step = steps[currentStep];

  useEffect(() => {
    if (step?.targetSelector) {
      const element = document.querySelector(step.targetSelector);
      if (element) {
        setHighlightElement(element);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentStep, step]);

  if (!step) return null;

  const rect = highlightElement?.getBoundingClientRect();

  return (
    <AnimatePresence>
      {/* Overlay backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 pointer-events-none"
      >
        {/* Dark overlay with spotlight */}
        <div className="absolute inset-0 bg-black/60 pointer-events-auto" />
        
        {/* Spotlight on target element */}
        {rect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute border-4 border-blue-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] pointer-events-none"
            style={{
              left: rect.left - 8,
              top: rect.top - 8,
              width: rect.width + 16,
              height: rect.height + 16,
            }}
          />
        )}

        {/* Instruction Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute pointer-events-auto"
          style={{
            left: rect ? Math.min(rect.left, window.innerWidth - 400) : '50%',
            top: rect ? rect.bottom + 20 : '50%',
            transform: !rect ? 'translate(-50%, -50%)' : 'none',
          }}
        >
          <Card className="w-96 p-6 shadow-2xl border-2 border-blue-500">
            {/* Progress */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-600">
                Step {currentStep + 1} of {steps.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={onSkip}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {step.title}
              </h3>
              <p className="text-slate-600">
                {step.description}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onSkip}
                className="flex-1"
              >
                Skip Tour
              </Button>
              
              {step.waitForAction ? (
                <div className="flex-1 text-center py-2 text-sm text-slate-500">
                  Waiting for action...
                </div>
              ) : (
                <Button
                  onClick={() => {
                    if (currentStep === steps.length - 1) {
                      onComplete();
                    } else {
                      onNext();
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600"
                >
                  {currentStep === steps.length - 1 ? (
                    <>
                      Finish
                      <CheckCircle className="h-4 w-4 ml-2" />
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}