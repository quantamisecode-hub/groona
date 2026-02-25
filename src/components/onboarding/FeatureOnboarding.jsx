import React, { useState, useEffect } from 'react';
import { groonabackend } from '@/api/groonabackend';
import { useQuery } from '@tanstack/react-query';
import { useOnboarding } from './OnboardingProvider';
import WelcomeGuideDialog from './WelcomeGuideDialog';
import GuidedSetupOverlay from './GuidedSetupOverlay';
import ContextualTooltip from './ContextualTooltip';
import OnboardingChecklist from './OnboardingChecklist';

export default function FeatureOnboarding({ currentUser, featureArea, userRole = 'user' }) {
  const onboarding = useOnboarding();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showGuided, setShowGuided] = useState(false);
  const [currentGuidedStep, setCurrentGuidedStep] = useState(0);

  // Fetch onboarding config for this feature
  const { data: configs = [] } = useQuery({
    queryKey: ['onboarding-config', featureArea, userRole],
    queryFn: async () => {
      const results = await groonabackend.entities.OnboardingFeatureConfig.filter({
        feature_area: featureArea,
        is_active: true
      });
      
      // Filter by role: return configs for 'all' or specific role
      return results.filter(c => c.role === 'all' || c.role === userRole);
    },
    enabled: !!featureArea,
    staleTime: 10 * 60 * 1000,
  });

  const config = configs[0]; // Use first matching config

  useEffect(() => {
    if (onboarding.shouldShowWelcomeGuide() && config?.welcome_slides?.length > 0) {
      setShowWelcome(true);
    }
  }, [onboarding.progress, config]);

  if (!config) return null;

  const handleStartGuide = () => {
    setShowWelcome(false);
    onboarding.completeWelcomeGuide();
    if (config.guided_steps?.length > 0) {
      setShowGuided(true);
    }
  };

  const handleSkipWelcome = () => {
    setShowWelcome(false);
    onboarding.skipOnboarding();
  };

  const handleNextGuidedStep = () => {
    if (currentGuidedStep < config.guided_steps.length - 1) {
      setCurrentGuidedStep(currentGuidedStep + 1);
    }
  };

  const handleCompleteGuided = () => {
    setShowGuided(false);
    onboarding.completeGuidedSetup();
  };

  const handleSkipGuided = () => {
    setShowGuided(false);
    onboarding.skipOnboarding();
  };

  return (
    <>
      {/* Welcome Guide */}
      {config.welcome_slides?.length > 0 && (
        <WelcomeGuideDialog
          open={showWelcome}
          onClose={() => setShowWelcome(false)}
          onStartGuide={handleStartGuide}
          onSkip={handleSkipWelcome}
          slides={config.welcome_slides}
        />
      )}

      {/* Guided Setup */}
      {showGuided && config.guided_steps?.length > 0 && (
        <GuidedSetupOverlay
          steps={config.guided_steps}
          currentStep={currentGuidedStep}
          onNext={handleNextGuidedStep}
          onSkip={handleSkipGuided}
          onComplete={handleCompleteGuided}
        />
      )}

      {/* Contextual Tooltips */}
      {config.contextual_tips?.map((tip) => (
        onboarding.shouldShowTip(tip.tipId) && (
          <ContextualTooltip
            key={tip.tipId}
            tipId={tip.tipId}
            message={tip.message}
            targetSelector={tip.targetSelector}
            position={tip.position}
            onDismiss={onboarding.dismissTip}
          />
        )
      ))}

      {/* Checklist */}
      {!onboarding.progress?.onboarding_skipped && config.checklist_items?.length > 0 && (
        <OnboardingChecklist
          items={config.checklist_items}
          progress={onboarding.progress}
          onRestartOnboarding={onboarding.restartOnboarding}
        />
      )}
    </>
  );
}

