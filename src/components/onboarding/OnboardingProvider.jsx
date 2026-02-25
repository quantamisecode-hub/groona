import React, { createContext, useContext, useState, useEffect } from 'react';
import { groonabackend } from '@/api/groonabackend';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const OnboardingContext = createContext(null);

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}

export function OnboardingProvider({ children, currentUser, featureArea = 'leave_management' }) {
  const queryClient = useQueryClient();

  // Fetch user's onboarding progress
  const { data: progress, isLoading } = useQuery({
    queryKey: ['onboarding-progress', currentUser?.id, featureArea],
    queryFn: async () => {
      const results = await groonabackend.entities.UserOnboardingProgress.filter({
        user_id: currentUser.id,
        feature_area: featureArea
      });
      
      if (results.length > 0) {
        return results[0];
      }
      
      // Create initial progress record
      return groonabackend.entities.UserOnboardingProgress.create({
        user_id: currentUser.id,
        user_email: currentUser.email,
        tenant_id: currentUser.tenant_id,
        feature_area: featureArea,
        completed_steps: [],
        dismissed_tips: [],
        checklist_items: {}
      });
    },
    enabled: !!currentUser?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Update progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: async (updates) => {
      return groonabackend.entities.UserOnboardingProgress.update(progress.id, {
        ...updates,
        last_interaction_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] });
    }
  });

  const markStepCompleted = (stepId) => {
    if (!progress?.completed_steps?.includes(stepId)) {
      updateProgressMutation.mutate({
        completed_steps: [...(progress?.completed_steps || []), stepId]
      });
    }
  };

  const markChecklistItem = (itemId, completed = true) => {
    updateProgressMutation.mutate({
      checklist_items: {
        ...(progress?.checklist_items || {}),
        [itemId]: completed
      }
    });
  };

  const dismissTip = (tipId) => {
    if (!progress?.dismissed_tips?.includes(tipId)) {
      updateProgressMutation.mutate({
        dismissed_tips: [...(progress?.dismissed_tips || []), tipId]
      });
    }
  };

  const completeWelcomeGuide = () => {
    updateProgressMutation.mutate({
      welcome_guide_completed: true
    });
  };

  const completeGuidedSetup = () => {
    updateProgressMutation.mutate({
      guided_setup_completed: true
    });
  };

  const skipOnboarding = () => {
    updateProgressMutation.mutate({
      onboarding_skipped: true,
      welcome_guide_completed: true,
      guided_setup_completed: true
    });
  };

  const restartOnboarding = () => {
    updateProgressMutation.mutate({
      welcome_guide_completed: false,
      guided_setup_completed: false,
      onboarding_skipped: false,
      completed_steps: [],
      dismissed_tips: [],
      checklist_items: {}
    });
  };

  const shouldShowWelcomeGuide = () => {
    return !isLoading && progress && !progress.welcome_guide_completed && !progress.onboarding_skipped;
  };

  const shouldShowGuidedSetup = () => {
    return !isLoading && progress && progress.welcome_guide_completed && !progress.guided_setup_completed && !progress.onboarding_skipped;
  };

  const shouldShowTip = (tipId) => {
    return !isLoading && progress && !progress.dismissed_tips?.includes(tipId);
  };

  const value = {
    progress,
    isLoading,
    markStepCompleted,
    markChecklistItem,
    dismissTip,
    completeWelcomeGuide,
    completeGuidedSetup,
    skipOnboarding,
    restartOnboarding,
    shouldShowWelcomeGuide,
    shouldShowGuidedSetup,
    shouldShowTip,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

