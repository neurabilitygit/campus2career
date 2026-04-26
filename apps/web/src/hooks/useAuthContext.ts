"use client";

import { useApiData } from "./useApiData";
import { useSession } from "./useSession";
import type { TestContextRole } from "../lib/testContext";
import type { CapabilityKey, Persona } from "../../../../packages/shared/src/capabilities";

export type AuthContextResponse = {
  authenticated?: boolean;
  context?: {
    authenticatedUserId?: string;
    authenticatedRoleType?: "student" | "parent" | "coach" | "admin";
    primaryPersona?: Persona;
    householdId?: string | null;
    studentProfileId?: string | null;
    studentUserId?: string | null;
    accountStatus?: string;
    authProvider?: string | null;
    isSuperAdmin?: boolean;
    effectiveCapabilities?: CapabilityKey[];
    deniedCapabilities?: CapabilityKey[];
    activeMemberships?: Array<{
      householdId: string;
      householdName?: string | null;
      roleInHousehold: string;
      membershipStatus: string;
      isPrimary: boolean;
    }>;
    email?: string;
    authenticatedFirstName?: string | null;
    authenticatedLastName?: string | null;
    authenticatedPreferredName?: string | null;
    hasCompletedIntroOnboarding?: boolean;
    introOnboardingCompletedAt?: string | null;
    introOnboardingSkippedAt?: string | null;
    introOnboardingVersion?: number;
    introOnboardingStatus?: "not_started" | "completed" | "skipped";
    introOnboardingShouldAutoShow?: boolean;
    currentIntroOnboardingVersion?: number;
    studentFirstName?: string | null;
    studentLastName?: string | null;
    studentPreferredName?: string | null;
    testContextSwitchingEnabled?: boolean;
    testContextAllowedRoles?: TestContextRole[];
    testContextOverrideRole?: TestContextRole | null;
  };
};

export function useAuthContext() {
  const session = useSession();
  const auth = useApiData<AuthContextResponse>("/auth/me", session.isAuthenticated);

  return {
    ...auth,
    isAuthenticated: session.isAuthenticated,
    sessionLoading: session.loading,
    sessionError: session.error,
    refreshSession: session.refresh,
  };
}
