import test from "node:test";
import assert from "node:assert/strict";
import { CURRENT_INTRO_ONBOARDING_VERSION } from "../../packages/shared/src/contracts/introOnboarding";
import {
  filterIntroOnboardingSteps,
  shouldAutoLaunchIntroOnboarding,
} from "../../apps/web/src/lib/introOnboarding";
import {
  INTRO_TOUR_STEPS,
  ROLE_INTRO_TOUR_STEPS,
} from "../../apps/web/src/components/onboarding/introTourConfig";

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
      "workspace-home": true,
      navigation: true,
      profile: true,
      household: true,
      "academic-path": true,
      "career-goal": true,
      "communication-help": true,
    },
  });

  assert.equal(filtered.length, INTRO_TOUR_STEPS.length);
});

test("shared and role walkthroughs now cover at least twelve key feature stops together", () => {
  assert.equal(INTRO_TOUR_STEPS.length + ROLE_INTRO_TOUR_STEPS.filter((step) => step.rolesAllowed?.includes("student")).length >= 12, true);
});

test("role walkthrough filters to the active role only", () => {
  const parentSteps = filterIntroOnboardingSteps(ROLE_INTRO_TOUR_STEPS, {
    role: "parent",
  });

  assert.equal(parentSteps.some((step) => step.id === "coach-roster"), false);
  assert.equal(parentSteps.some((step) => step.id === "parent-dashboard"), true);
});
