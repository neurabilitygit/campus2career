"use client";

import { useApiData } from "./useApiData";
import { useSession } from "./useSession";
import type { TestContextRole } from "../lib/testContext";

export type AuthContextResponse = {
  authenticated?: boolean;
  context?: {
    authenticatedRoleType?: "student" | "parent" | "coach" | "admin";
    householdId?: string | null;
    studentProfileId?: string | null;
    studentUserId?: string | null;
    email?: string;
    authenticatedFirstName?: string | null;
    authenticatedLastName?: string | null;
    authenticatedPreferredName?: string | null;
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
