import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Lightbulb } from 'lucide-react';

export default function ContextualTooltip({ 
  tipId, 
  message, 
  targetSelector, 
  position = 'bottom',
  onDismiss 
}) {
  const [targetElement, setTargetElement] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const element = document.querySelector(targetSelector);
    if (element) {
      setTargetElement(element);
      // Delay showing to avoid flash during page load
      setTimeout(() => setShow(true), 500);
    }
  }, [targetSelector]);

  if (!targetElement || !show) return null;

  const rect = targetElement.getBoundingClientRect();
  
  const positions = {
    top: { left: rect.left + rect.width / 2, top: rect.top - 10, transform: 'translate(-50%, -100%)' },
    bottom: { left: rect.left + rect.width / 2, top: rect.bottom + 10, transform: 'translateX(-50%)' },
    left: { left: rect.left - 10, top: rect.top + rect.height / 2, transform: 'translate(-100%, -50%)' },
    right: { left: rect.right + 10, top: rect.top + rect.height / 2, transform: 'translateY(-50%)' }
  };

  const handleDismiss = () => {
    setShow(false);
    setTimeout(() => onDismiss(tipId), 300);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed z-50 pointer-events-auto"
          style={positions[position]}
        >
          <div className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-xs flex items-start gap-3">
            <Lightbulb className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm">{message}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-6 w-6 text-white hover:bg-blue-700 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Arrow */}
          <div 
            className="absolute w-3 h-3 bg-blue-600 transform rotate-45"
            style={
              position === 'bottom' ? { top: -6, left: '50%', marginLeft: -6 } :
              position === 'top' ? { bottom: -6, left: '50%', marginLeft: -6 } :
              position === 'right' ? { left: -6, top: '50%', marginTop: -6 } :
              { right: -6, top: '50%', marginTop: -6 }
            }
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}