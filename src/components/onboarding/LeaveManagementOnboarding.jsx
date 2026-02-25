import React, { useState, useEffect } from 'react';
import { useOnboarding } from './OnboardingProvider';
import WelcomeGuideDialog from './WelcomeGuideDialog';
import GuidedSetupOverlay from './GuidedSetupOverlay';
import ContextualTooltip from './ContextualTooltip';
import OnboardingChecklist from './OnboardingChecklist';

export default function LeaveManagementOnboarding({ currentUser, isAdmin }) {
  const onboarding = useOnboarding();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showGuided, setShowGuided] = useState(false);
  const [currentGuidedStep, setCurrentGuidedStep] = useState(0);

  useEffect(() => {
    if (onboarding.shouldShowWelcomeGuide()) {
      setShowWelcome(true);
    }
  }, [onboarding.progress]);

  const guidedSteps = isAdmin ? [
    {
      targetSelector: '[data-onboarding="leave-types-tab"]',
      title: 'Configure Leave Types',
      description: 'Start by setting up leave types for your organization (Casual, Sick, etc.)',
    },
    {
      targetSelector: '[data-onboarding="annual-allocation-button"]',
      title: 'Allocate Leave Balance',
      description: 'Run the annual allocation to give employees their yearly leave days',
    },
    {
      targetSelector: '[data-onboarding="approvals-tab"]',
      title: 'Manage Approvals',
      description: 'Review and approve leave requests from your team members',
    },
    {
      targetSelector: '[data-onboarding="comp-off-tab"]',
      title: 'Compensatory Off',
      description: 'Credit extra days off for employees who worked on holidays',
    }
  ] : [
    {
      targetSelector: '[data-onboarding="overview-tab"]',
      title: 'Your Leave Dashboard',
      description: 'See your leave balance, upcoming leaves, and team availability at a glance',
    },
    {
      targetSelector: '[data-onboarding="apply-leave-button"]',
      title: 'Apply for Leave',
      description: 'Click here whenever you need to request time off',
    },
    {
      targetSelector: '[data-onboarding="balances-tab"]',
      title: 'Check Your Balance',
      description: 'View how many leave days you have remaining for each type',
    },
    {
      targetSelector: '[data-onboarding="my-leaves-tab"]',
      title: 'Track Your Requests',
      description: 'Monitor the status of your leave requests (pending, approved, or rejected)',
    }
  ];

  const checklistItems = isAdmin ? [
    { id: 'review_leave_types', label: 'Configure leave types', hint: 'Go to Configuration tab' },
    { id: 'allocate_leave', label: 'Run annual allocation', hint: 'Click Annual Allocation button' },
    { id: 'review_approval', label: 'Review a leave request', hint: 'Check Approvals tab' },
    { id: 'grant_comp_off', label: 'Grant comp off to an employee', hint: 'Use Comp Off tab' }
  ] : [
    { id: 'view_leave_balance', label: 'View your leave balance', hint: 'Check Balances tab' },
    { id: 'apply_first_leave', label: 'Apply for your first leave', hint: 'Click Apply Leave button' },
    { id: 'check_leave_calendar', label: 'Check team availability', hint: 'View Overview dashboard' },
    { id: 'submit_leave_request', label: 'Submit a leave request', hint: 'Complete the application form' }
  ];

  const handleStartGuide = () => {
    setShowWelcome(false);
    onboarding.completeWelcomeGuide();
    setShowGuided(true);
  };

  const handleSkipWelcome = () => {
    setShowWelcome(false);
    onboarding.skipOnboarding();
  };

  const handleNextGuidedStep = () => {
    if (currentGuidedStep < guidedSteps.length - 1) {
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
      <WelcomeGuideDialog
        open={showWelcome}
        onClose={() => setShowWelcome(false)}
        onStartGuide={handleStartGuide}
        onSkip={handleSkipWelcome}
      />

      {/* Guided Setup */}
      {showGuided && (
        <GuidedSetupOverlay
          steps={guidedSteps}
          currentStep={currentGuidedStep}
          onNext={handleNextGuidedStep}
          onSkip={handleSkipGuided}
          onComplete={handleCompleteGuided}
        />
      )}

      {/* Contextual Tooltips */}
      {onboarding.shouldShowTip('leave-balance-tip') && (
        <ContextualTooltip
          tipId="leave-balance-tip"
          message="Your leave balance shows how many days you have left for each leave type"
          targetSelector="[data-tip='leave-balance']"
          position="bottom"
          onDismiss={onboarding.dismissTip}
        />
      )}

      {/* Checklist */}
      {!onboarding.progress?.onboarding_skipped && (
        <OnboardingChecklist
          items={checklistItems}
          progress={onboarding.progress}
          onRestartOnboarding={onboarding.restartOnboarding}
        />
      )}
    </>
  );
}