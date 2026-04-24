"use client";

import {
  CURRENT_INTRO_ONBOARDING_VERSION,
  type IntroOnboardingStatus,
} from "../../../../packages/shared/src/contracts/introOnboarding";

export const INTRO_ONBOARDING_REPLAY_EVENT = "rising-senior:intro-onboarding-replay";

export type IntroOnboardingRole = "student" | "parent" | "coach" | "admin";

export type IntroTourStepPlacement = "top" | "right" | "bottom" | "left" | "center";

export type IntroTourStepConfig = {
  id: string;
  title: string;
  body: string;
  targetSelector: string;
  fallbackSelector?: string;
  placement?: IntroTourStepPlacement;
  rolesAllowed?: IntroOnboardingRole[];
  skipIfTargetMissing?: boolean;
};

export type IntroOnboardingContext = {
  authenticated: boolean;
  introOnboardingStatus?: IntroOnboardingStatus | null;
  introOnboardingVersion?: number | null;
  introOnboardingShouldAutoShow?: boolean | null;
};

export function shouldAutoLaunchIntroOnboarding(
  context: IntroOnboardingContext | null | undefined
) {
  if (!context?.authenticated) {
    return false;
  }

  const status = context.introOnboardingStatus ?? "not_started";
  const version =
    typeof context.introOnboardingVersion === "number"
      ? context.introOnboardingVersion
      : CURRENT_INTRO_ONBOARDING_VERSION;

  if (context.introOnboardingShouldAutoShow != null) {
    return context.introOnboardingShouldAutoShow;
  }

  return status === "not_started" || version < CURRENT_INTRO_ONBOARDING_VERSION;
}

export function filterIntroOnboardingSteps(
  steps: IntroTourStepConfig[],
  options: {
    role: IntroOnboardingRole | null;
    availableTargets?: Record<string, boolean>;
  }
) {
  return steps.filter((step) => {
    if (step.rolesAllowed?.length && (!options.role || !step.rolesAllowed.includes(options.role))) {
      return false;
    }

    if (!step.skipIfTargetMissing) {
      return true;
    }

    if (!options.availableTargets) {
      return true;
    }

    return options.availableTargets[step.id] !== false;
  });
}

export function findIntroTarget(
  step: Pick<IntroTourStepConfig, "targetSelector" | "fallbackSelector">
) {
  if (typeof document === "undefined") {
    return null;
  }

  const selectors = [step.targetSelector, step.fallbackSelector].filter(
    (value): value is string => !!value
  );

  for (const selector of selectors) {
    const match = document.querySelector<HTMLElement>(selector);
    if (match && match.getClientRects().length > 0) {
      return match;
    }
  }

  return null;
}

export function launchIntroOnboardingReplay() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(INTRO_ONBOARDING_REPLAY_EVENT));
}
