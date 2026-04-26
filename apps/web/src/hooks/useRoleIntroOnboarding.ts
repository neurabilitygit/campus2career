"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { IntroOnboardingStage } from "./useIntroOnboarding";
import type { IntroOnboardingRole, IntroTourStepConfig } from "../lib/introOnboarding";
import { findIntroTarget } from "../lib/introOnboarding";
import {
  ROLE_INTRO_ONBOARDING_REPLAY_EVENT,
  getResolvedRoleIntroSteps,
  hasCompletedRoleIntroOnboarding,
  markRoleIntroOnboardingCompleted,
} from "../lib/roleIntroOnboarding";

export function useRoleIntroOnboarding(options: {
  pathname: string;
  authenticated: boolean;
  authResolved: boolean;
  userId?: string | null;
  role: IntroOnboardingRole | null;
  steps: IntroTourStepConfig[];
}) {
  const [stage, setStage] = useState<IntroOnboardingStage>("hidden");
  const [skipOrigin, setSkipOrigin] = useState<"tour" | "splash">("tour");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    setCompleted(hasCompletedRoleIntroOnboarding(options.userId, options.role));
  }, [options.role, options.userId]);

  const steps = useMemo(
    () => getResolvedRoleIntroSteps(options.steps, options.role),
    [options.role, options.steps, options.pathname, stage]
  );
  const activeStep = steps[currentIndex] || null;
  const target = useMemo(() => (activeStep ? findIntroTarget(activeStep) : null), [activeStep]);

  useEffect(() => {
    function handleReplay() {
      if (!options.authenticated || !options.authResolved || !options.role || !steps.length) {
        return;
      }
      setCompleted(false);
      setError(null);
      setCurrentIndex(0);
      setStage("tour");
    }

    window.addEventListener(ROLE_INTRO_ONBOARDING_REPLAY_EVENT, handleReplay);
    return () => {
      window.removeEventListener(ROLE_INTRO_ONBOARDING_REPLAY_EVENT, handleReplay);
    };
  }, [options.authResolved, options.authenticated, options.role, steps.length]);

  useEffect(() => {
    if (!steps.length) {
      setCurrentIndex(0);
      return;
    }

    setCurrentIndex((value) => Math.min(value, steps.length - 1));
  }, [steps.length]);

  const close = useCallback(() => {
    setStage("hidden");
    setSkipOrigin("tour");
    setCurrentIndex(0);
    setError(null);
  }, []);

  const startTour = useCallback(() => {
    if (!steps.length) {
      return;
    }
    setError(null);
    setCurrentIndex(0);
    setStage("tour");
  }, [steps.length]);

  const openSkipConfirmation = useCallback(() => {
    setSkipOrigin("tour");
    setStage("skip_confirm");
  }, []);

  const cancelSkipConfirmation = useCallback(() => {
    setStage(skipOrigin);
  }, [skipOrigin]);

  const goBack = useCallback(() => {
    setCurrentIndex((value) => Math.max(value - 1, 0));
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((value) => Math.min(value + 1, Math.max(steps.length - 1, 0)));
  }, [steps.length]);

  const persistCompletion = useCallback(() => {
    markRoleIntroOnboardingCompleted(options.userId, options.role);
    setCompleted(true);
    close();
  }, [close, options.role, options.userId]);

  return {
    stage,
    steps,
    currentIndex,
    activeStep,
    target,
    error,
    canGoBack: currentIndex > 0,
    isLastStep: currentIndex === steps.length - 1,
    isComplete: completed,
    canAutoLaunch:
      options.authenticated &&
      options.authResolved &&
      !!options.role &&
      !!options.userId &&
      !completed &&
      steps.length > 0,
    startTour,
    openSkipConfirmation,
    cancelSkipConfirmation,
    goBack,
    goNext,
    close,
    complete() {
      persistCompletion();
    },
    skip() {
      persistCompletion();
    },
  };
}
