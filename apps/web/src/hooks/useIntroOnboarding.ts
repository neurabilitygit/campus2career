"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../lib/apiClient";
import {
  CURRENT_INTRO_ONBOARDING_VERSION,
  type IntroOnboardingStatus,
} from "../../../../packages/shared/src/contracts/introOnboarding";
import {
  INTRO_ONBOARDING_REPLAY_EVENT,
  filterIntroOnboardingSteps,
  findIntroTarget,
  shouldAutoLaunchIntroOnboarding,
  type IntroOnboardingRole,
  type IntroTourStepConfig,
} from "../lib/introOnboarding";

export type IntroOnboardingStage = "hidden" | "splash" | "tour" | "skip_confirm";

function useResolvedSteps(
  steps: IntroTourStepConfig[],
  role: IntroOnboardingRole | null,
  stage: IntroOnboardingStage,
  pathname: string
) {
  return useMemo(() => {
    const availableTargets =
      typeof document === "undefined" || stage === "hidden"
        ? undefined
        : Object.fromEntries(steps.map((step) => [step.id, !!findIntroTarget(step)]));

    return filterIntroOnboardingSteps(steps, {
      role,
      availableTargets,
    });
  }, [pathname, role, stage, steps]);
}

export function useIntroOnboarding(options: {
  pathname: string;
  authenticated: boolean;
  authResolved: boolean;
  role: IntroOnboardingRole | null;
  introOnboardingStatus?: IntroOnboardingStatus | null;
  introOnboardingVersion?: number | null;
  introOnboardingShouldAutoShow?: boolean | null;
  steps: IntroTourStepConfig[];
}) {
  const [stage, setStage] = useState<IntroOnboardingStage>("hidden");
  const [skipOrigin, setSkipOrigin] = useState<"splash" | "tour">("tour");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pending, setPending] = useState<"complete" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<{
    status: IntroOnboardingStatus;
    version: number;
    shouldAutoShow: boolean;
  } | null>(null);
  const autoShownRef = useRef(false);
  const steps = useResolvedSteps(options.steps, options.role, stage, options.pathname);

  const onboardingState = {
    status: localStatus?.status ?? options.introOnboardingStatus ?? "not_started",
    version:
      localStatus?.version ??
      options.introOnboardingVersion ??
      CURRENT_INTRO_ONBOARDING_VERSION,
    shouldAutoShow:
      localStatus?.shouldAutoShow ??
      shouldAutoLaunchIntroOnboarding({
        authenticated: options.authenticated,
        introOnboardingStatus: options.introOnboardingStatus,
        introOnboardingVersion: options.introOnboardingVersion,
        introOnboardingShouldAutoShow: options.introOnboardingShouldAutoShow,
      }),
  };

  const activeStep = steps[currentIndex] || null;
  const target = useMemo(() => (activeStep ? findIntroTarget(activeStep) : null), [activeStep, stage]);

  useEffect(() => {
    if (stage !== "tour" || !target) {
      return;
    }

    target.dataset.introHighlighted = "true";

    const handleClick = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      setCurrentIndex((value) => {
        if (value >= steps.length - 1) {
          return value;
        }
        return value + 1;
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        handleClick(event);
      }
    };

    target.addEventListener("click", handleClick, true);
    target.addEventListener("keydown", handleKeyDown, true);

    return () => {
      delete target.dataset.introHighlighted;
      target.removeEventListener("click", handleClick, true);
      target.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [stage, steps.length, target]);

  useEffect(() => {
    if (!options.authResolved || !options.authenticated || options.pathname === "/app" || !steps.length) {
      return;
    }

    if (onboardingState.shouldAutoShow && !autoShownRef.current) {
      autoShownRef.current = true;
      setCurrentIndex(0);
      setStage("splash");
    }
  }, [onboardingState.shouldAutoShow, options.authResolved, options.authenticated, options.pathname, steps.length]);

  useEffect(() => {
    function handleReplay() {
      setError(null);
      setCurrentIndex(0);
      setStage("splash");
    }

    window.addEventListener(INTRO_ONBOARDING_REPLAY_EVENT, handleReplay);
    return () => {
      window.removeEventListener(INTRO_ONBOARDING_REPLAY_EVENT, handleReplay);
    };
  }, []);

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
    setPending(null);
  }, []);

  const startTour = useCallback(() => {
    setError(null);
    setStage("tour");
  }, []);

  const openSkipConfirmation = useCallback(() => {
    setSkipOrigin(stage === "splash" ? "splash" : "tour");
    setStage("skip_confirm");
  }, [stage]);

  const cancelSkipConfirmation = useCallback(() => {
    setStage(skipOrigin);
  }, [skipOrigin]);

  const goBack = useCallback(() => {
    setCurrentIndex((value) => Math.max(value - 1, 0));
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((value) => Math.min(value + 1, Math.max(steps.length - 1, 0)));
  }, [steps.length]);

  async function persist(path: string, nextStatus: IntroOnboardingStatus) {
    setPending(nextStatus === "completed" ? "complete" : "skip");
    setError(null);

    try {
      const result = (await apiFetch(path, {
        method: "POST",
        body: JSON.stringify({
          introOnboardingVersion: CURRENT_INTRO_ONBOARDING_VERSION,
        }),
      })) as {
        onboarding?: {
          introOnboardingStatus?: IntroOnboardingStatus;
          introOnboardingVersion?: number;
        };
      };

      setLocalStatus({
        status: result.onboarding?.introOnboardingStatus ?? nextStatus,
        version:
          result.onboarding?.introOnboardingVersion ??
          CURRENT_INTRO_ONBOARDING_VERSION,
        shouldAutoShow: false,
      });
      autoShownRef.current = true;
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(null);
    }
  }

  return {
    stage,
    steps,
    currentIndex,
    activeStep,
    target,
    pending,
    error,
    canGoBack: currentIndex > 0,
    isLastStep: currentIndex === steps.length - 1,
    startTour,
    openSkipConfirmation,
    cancelSkipConfirmation,
    goBack,
    goNext,
    close,
    complete() {
      return persist("/auth/intro-onboarding/complete", "completed");
    },
    skip() {
      return persist("/auth/intro-onboarding/skip", "skipped");
    },
  };
}
