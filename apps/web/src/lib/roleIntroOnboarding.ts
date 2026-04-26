"use client";

import type { IntroOnboardingRole, IntroTourStepConfig } from "./introOnboarding";
import { filterIntroOnboardingSteps, findIntroTarget } from "./introOnboarding";

export const ROLE_INTRO_ONBOARDING_REPLAY_EVENT = "rising-senior:role-intro-onboarding-replay";
export const CURRENT_ROLE_INTRO_ONBOARDING_VERSION = 1;

function roleIntroStorageKey(userId: string, role: IntroOnboardingRole) {
  return `rising-senior:role-intro:${CURRENT_ROLE_INTRO_ONBOARDING_VERSION}:${userId}:${role}`;
}

export function hasCompletedRoleIntroOnboarding(userId: string | null | undefined, role: IntroOnboardingRole | null) {
  if (!userId || !role || typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(roleIntroStorageKey(userId, role)) === "completed";
}

export function markRoleIntroOnboardingCompleted(userId: string | null | undefined, role: IntroOnboardingRole | null) {
  if (!userId || !role || typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(roleIntroStorageKey(userId, role), "completed");
}

export function getResolvedRoleIntroSteps(
  steps: IntroTourStepConfig[],
  role: IntroOnboardingRole | null
) {
  const availableTargets =
    typeof document === "undefined"
      ? undefined
      : Object.fromEntries(steps.map((step) => [step.id, !!findIntroTarget(step)]));

  return filterIntroOnboardingSteps(steps, {
    role,
    availableTargets,
  });
}

export function launchRoleIntroOnboardingReplay() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(ROLE_INTRO_ONBOARDING_REPLAY_EVENT));
}
