import {
  CURRENT_INTRO_ONBOARDING_VERSION,
  type IntroOnboardingState,
  type IntroOnboardingStatus,
} from "../../../../../packages/shared/src/contracts/introOnboarding";

export type IntroOnboardingView = IntroOnboardingState & {
  shouldAutoShow: boolean;
  currentVersion: number;
};

export function buildIntroOnboardingView(
  state: IntroOnboardingState | null | undefined
): IntroOnboardingView {
  const normalized: IntroOnboardingState = {
    hasCompletedIntroOnboarding: state?.hasCompletedIntroOnboarding ?? false,
    introOnboardingCompletedAt: state?.introOnboardingCompletedAt ?? null,
    introOnboardingSkippedAt: state?.introOnboardingSkippedAt ?? null,
    introOnboardingVersion: state?.introOnboardingVersion ?? CURRENT_INTRO_ONBOARDING_VERSION,
    introOnboardingStatus: (state?.introOnboardingStatus ?? "not_started") as IntroOnboardingStatus,
  };

  return {
    ...normalized,
    shouldAutoShow:
      normalized.introOnboardingStatus === "not_started" ||
      normalized.introOnboardingVersion < CURRENT_INTRO_ONBOARDING_VERSION,
    currentVersion: CURRENT_INTRO_ONBOARDING_VERSION,
  };
}
