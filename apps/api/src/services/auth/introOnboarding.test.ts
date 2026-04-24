import test from "node:test";
import assert from "node:assert/strict";
import { CURRENT_INTRO_ONBOARDING_VERSION } from "../../../../../packages/shared/src/contracts/introOnboarding";
import { buildIntroOnboardingView } from "./introOnboarding";

test("buildIntroOnboardingView defaults missing state to a first-run intro", () => {
  const result = buildIntroOnboardingView(null);

  assert.equal(result.introOnboardingStatus, "not_started");
  assert.equal(result.shouldAutoShow, true);
  assert.equal(result.currentVersion, CURRENT_INTRO_ONBOARDING_VERSION);
});

test("buildIntroOnboardingView suppresses auto-show for completed current-version state", () => {
  const result = buildIntroOnboardingView({
    hasCompletedIntroOnboarding: true,
    introOnboardingCompletedAt: "2026-04-24T00:00:00.000Z",
    introOnboardingSkippedAt: null,
    introOnboardingVersion: CURRENT_INTRO_ONBOARDING_VERSION,
    introOnboardingStatus: "completed",
  });

  assert.equal(result.shouldAutoShow, false);
});

test("buildIntroOnboardingView re-enables auto-show when the stored version is older", () => {
  const result = buildIntroOnboardingView({
    hasCompletedIntroOnboarding: true,
    introOnboardingCompletedAt: "2026-04-24T00:00:00.000Z",
    introOnboardingSkippedAt: null,
    introOnboardingVersion: CURRENT_INTRO_ONBOARDING_VERSION - 1,
    introOnboardingStatus: "completed",
  });

  assert.equal(result.shouldAutoShow, true);
});
