import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Users, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WelcomeGuideDialog({ open, onClose, onStartGuide, onSkip, slides: customSlides }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Default slides if none provided
  const defaultSlides = [
    {
      icon: 'Calendar',
      title: 'Welcome',
      description: 'Let us guide you through this feature.',
      color: 'from-blue-500 to-purple-600'
    }
  ];

  const slides = customSlides || defaultSlides;

  // Icon mapping
  const iconMap = {
    Calendar, Clock, Users,
    CheckCircle, ArrowRight, ArrowLeft
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onStartGuide();
    }
  };

  const handleBack = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const currentSlideData = slides[currentSlide];
  const Icon = typeof currentSlideData.icon === 'string' 
    ? iconMap[currentSlideData.icon] || Calendar 
    : currentSlideData.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="p-8"
          >
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className={`h-20 w-20 rounded-2xl bg-gradient-to-br ${currentSlideData.color} flex items-center justify-center shadow-lg`}>
                <Icon className="h-10 w-10 text-white" />
              </div>
            </div>

            {/* Content */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                {currentSlideData.title}
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed">
                {currentSlideData.description}
              </p>
            </div>

            {/* Progress Dots */}
            <div className="flex justify-center gap-2 mb-8">
              {slides.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentSlide 
                      ? 'w-8 bg-gradient-to-r ' + currentSlideData.color
                      : 'w-2 bg-slate-200'
                  }`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {currentSlide > 0 && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
              
              {currentSlide === 0 && (
                <Button
                  variant="ghost"
                  onClick={onSkip}
                  className="flex-1 text-slate-600"
                >
                  Skip Tour
                </Button>
              )}
              
              <Button
                onClick={handleNext}
                className={`flex-1 bg-gradient-to-r ${currentSlideData.color} text-white hover:opacity-90`}
              >
                {currentSlide === slides.length - 1 ? (
                  <>
                    Start Guided Tour
                    <CheckCircle className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}