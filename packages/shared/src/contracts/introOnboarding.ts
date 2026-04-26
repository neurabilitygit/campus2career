export type IntroOnboardingStatus = "not_started" | "completed" | "skipped";

export type IntroOnboardingState = {
  hasCompletedIntroOnboarding: boolean;
  introOnboardingCompletedAt: string | null;
  introOnboardingSkippedAt: string | null;
  introOnboardingVersion: number;
  introOnboardingStatus: IntroOnboardingStatus;
};

export const CURRENT_INTRO_ONBOARDING_VERSION = 2;
