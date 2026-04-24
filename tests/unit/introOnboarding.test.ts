import test from "node:test";
import assert from "node:assert/strict";
import { CURRENT_INTRO_ONBOARDING_VERSION } from "../../packages/shared/src/contracts/introOnboarding";
import {
  filterIntroOnboardingSteps,
  shouldAutoLaunchIntroOnboarding,
} from "../../apps/web/src/lib/introOnboarding";
import { INTRO_TOUR_STEPS } from "../../apps/web/src/components/onboarding/introTourConfig";

test("intro onboarding auto-launches for a new authenticated user", () => {
  assert.equal(
    shouldAutoLaunchIntroOnboarding({
      authenticated: true,
      introOnboardingStatus: "not_started",
      introOnboardingVersion: CURRENT_INTRO_ONBOARDING_VERSION,
    }),
    true
  );
});

test("intro onboarding does not auto-launch after completion on the current version", () => {
  assert.equal(
    shouldAutoLaunchIntroOnboarding({
      authenticated: true,
      introOnboardingStatus: "completed",
      introOnboardingVersion: CURRENT_INTRO_ONBOARDING_VERSION,
    }),
    false
  );
});

test("intro onboarding can relaunch for an older completed version", () => {
  assert.equal(
    shouldAutoLaunchIntroOnboarding({
      authenticated: true,
      introOnboardingStatus: "completed",
      introOnboardingVersion: CURRENT_INTRO_ONBOARDING_VERSION - 1,
    }),
    true
  );
});

test("step filtering removes missing optional targets", () => {
  const filtered = filterIntroOnboardingSteps(INTRO_TOUR_STEPS, {
    role: "student",
    availableTargets: {
      dashboard: true,
      profile: true,
      curriculum: true,
      scoring: false,
      actions: true,
      communication: true,
      help: true,
    },
  });

  assert.equal(filtered.some((step) => step.id === "scoring"), false);
  assert.equal(filtered.length, 6);
});
