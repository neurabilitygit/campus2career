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

function formatIntroOnboardingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.startsWith("API request failed:")) {
    return "We could not save your intro progress yet. Try again in a moment with your session still active.";
  }

  if (message.startsWith("API request timed out")) {
    return "Saving your intro progress took too long. Try again in a moment.";
  }

  return message;
}

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
  userId?: string | null;
  role: IntroOnboardingRole | null;
  introOnboardingStatus?: IntroOnboardingStatus | null;
  introOnboardingVersion?: number | null;
  introOnboardingShouldAutoShow?: boolean | null;
  steps: IntroTourStepConfig[];
}) {
  const storageKey = options.userId ? `rising-senior:intro-onboarding:${options.userId}` : null;
  const [stage, setStage] = useState<IntroOnboardingStage>("hidden");
  const [skipOrigin, setSkipOrigin] = useState<"splash" | "tour">("tour");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pending, setPending] = useState<"complete" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastDismissal, setLastDismissal] = useState<"completed" | "skipped" | null>(null);
  const [localStatus, setLocalStatus] = useState<{
    status: IntroOnboardingStatus;
    version: number;
    shouldAutoShow: boolean;
  } | null>(() => {
    if (!storageKey || typeof window === "undefined") {
      return null;
    }
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as {
        status?: IntroOnboardingStatus;
        version?: number;
        shouldAutoShow?: boolean;
      };
      if (!parsed.status || typeof parsed.version !== "number") {
        return null;
      }
      return {
        status: parsed.status,
        version: parsed.version,
        shouldAutoShow: !!parsed.shouldAutoShow,
      };
    } catch {
      return null;
    }
  });
  const [localStatusHydrated, setLocalStatusHydrated] = useState(() => !storageKey);
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
    if (!storageKey || typeof window === "undefined") {
      setLocalStatus(null);
      setLocalStatusHydrated(true);
      return;
    }
    setLocalStatusHydrated(false);
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) {
        setLocalStatus(null);
        setLocalStatusHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as {
        status?: IntroOnboardingStatus;
        version?: number;
        shouldAutoShow?: boolean;
      };
      if (!parsed.status || typeof parsed.version !== "number") {
        setLocalStatus(null);
        setLocalStatusHydrated(true);
        return;
      }
      setLocalStatus({
        status: parsed.status,
        version: parsed.version,
        shouldAutoShow: !!parsed.shouldAutoShow,
      });
      setLocalStatusHydrated(true);
    } catch {
      setLocalStatus(null);
      setLocalStatusHydrated(true);
    }
  }, [storageKey]);

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
    if (!storageKey || typeof window === "undefined") {
      return;
    }

    if (!localStatus) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

    window.sessionStorage.setItem(storageKey, JSON.stringify(localStatus));
  }, [localStatus, storageKey]);

  useEffect(() => {
    if (
      !options.authResolved ||
      !options.authenticated ||
      options.pathname === "/app" ||
      !steps.length ||
      (storageKey && !localStatusHydrated)
    ) {
      return;
    }

    if (onboardingState.shouldAutoShow && !autoShownRef.current) {
      autoShownRef.current = true;
      setCurrentIndex(0);
      setStage("splash");
    }
  }, [
    localStatusHydrated,
    onboardingState.shouldAutoShow,
    options.authResolved,
    options.authenticated,
    options.pathname,
    steps.length,
    storageKey,
  ]);

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

  async function persist(path: string, nextStatus: "completed" | "skipped") {
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

      const persistedState = {
        status: result.onboarding?.introOnboardingStatus ?? nextStatus,
        version:
          result.onboarding?.introOnboardingVersion ??
          CURRENT_INTRO_ONBOARDING_VERSION,
        shouldAutoShow: false,
      };
      setLocalStatus(persistedState);
      if (storageKey && typeof window !== "undefined") {
        window.sessionStorage.setItem(storageKey, JSON.stringify(persistedState));
      }
      setLastDismissal(nextStatus);
      autoShownRef.current = true;
      close();
    } catch (cause) {
      setError(formatIntroOnboardingError(cause));
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
    onboardingStatus: onboardingState.status,
    onboardingVersion: onboardingState.version,
    lastDismissal,
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
