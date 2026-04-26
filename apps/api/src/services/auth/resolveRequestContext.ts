import crypto from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { CapabilityKey, Persona } from "../../../../../packages/shared/src/capabilities";
import { getAuthenticatedUser } from "../../middleware/auth";
import { permissionRepository } from "../../repositories/auth/permissionRepository";
import { UserContextRepository } from "../../repositories/auth/userContextRepository";
import { StudentWriteRepository } from "../../repositories/student/studentWriteRepository";
import { AppError } from "../../utils/appError";
import { buildIntroOnboardingView } from "./introOnboarding";
import { buildEffectivePermissions, resolvePrimaryMembership } from "./permissions";
import { syncAuthenticatedUser } from "./syncAuthenticatedUser";

export interface RequestContext {
  authenticatedUserId: string;
  authenticatedRoleType: "student" | "parent" | "coach" | "admin";
  primaryPersona: Persona;
  householdId: string | null;
  studentProfileId: string | null;
  studentUserId: string | null;
  accountStatus?: string;
  authProvider?: string | null;
  isSuperAdmin?: boolean;
  effectiveCapabilities?: CapabilityKey[];
  deniedCapabilities?: CapabilityKey[];
  activeMemberships?: Array<{
    householdId: string;
    householdName: string | null;
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
  testContextAllowedRoles?: Array<"student" | "parent" | "coach">;
  testContextOverrideRole?: "student" | "parent" | "coach" | null;
}

const repo = new UserContextRepository();
const studentWriteRepo = new StudentWriteRepository();

function normalizeRole(role: string | null | undefined): RequestContext["authenticatedRoleType"] | null {
  if (role === "student" || role === "parent" || role === "coach" || role === "admin") {
    return role;
  }
  return null;
}

function stableId(namespace: string, key: string): string {
  return crypto.createHash("sha256").update(`${namespace}:${key}`).digest("hex").slice(0, 32);
}

function parseAllowedTestSuperuserEmails(): string[] {
  return (process.env.TEST_SUPERUSER_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function canUseTestContextSwitching(email?: string): boolean {
  if (process.env.ALLOW_TEST_CONTEXT_SWITCHING !== "true") {
    return false;
  }

  if (!email) {
    return false;
  }

  return parseAllowedTestSuperuserEmails().includes(email.toLowerCase());
}

function readRequestedTestRole(req: IncomingMessage): "student" | "parent" | "coach" | null {
  const headerValue = req.headers["x-test-context-role"];
  if (typeof headerValue !== "string") {
    return null;
  }

  if (headerValue === "student" || headerValue === "parent" || headerValue === "coach") {
    return headerValue;
  }

  return null;
}

export async function resolveRequestContext(req: IncomingMessage): Promise<RequestContext> {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    throw new Error("UNAUTHENTICATED");
  }

  // keep this awaited to ensure user is synced before downstream queries
  const canonicalUserId = await syncAuthenticatedUser(auth);

  await permissionRepository.ensureCapabilityCatalogSynced();

  const [account, memberships] = await Promise.all([
    permissionRepository.getUserAccount(canonicalUserId),
    permissionRepository.listMembershipsForUser(canonicalUserId),
  ]);

  if (!account) {
    throw new AppError({
      status: 503,
      code: "auth_user_sync_failed",
      message: "Authenticated user could not be loaded after sync.",
      details: { authenticatedUserId: canonicalUserId, upstreamAuthenticatedUserId: auth.userId },
    });
  }

  const primaryMembership = resolvePrimaryMembership(memberships);
  const overrides = await permissionRepository.listCapabilityOverridesForUser(
    canonicalUserId,
    primaryMembership?.householdId ?? null
  );
  const effectivePermissions = buildEffectivePermissions({
    account,
    memberships,
    overrides,
  });

  const defaultRole = normalizeRole(effectivePermissions.primaryPersona);
  if (!defaultRole) {
    throw new AppError({
      status: 503,
      code: "auth_role_resolution_failed",
      message:
        "Authenticated role could not be resolved from the current user and household wiring.",
      details: {
        authenticatedUserId: auth.userId,
        upstreamAuthenticatedUserId: auth.userId,
        upstreamRoleType: auth.roleType || null,
        resolvedRoleRaw: effectivePermissions.primaryPersona || null,
      },
    });
  }
  const testContextAllowed = canUseTestContextSwitching(auth.email);
  const requestedTestRole = testContextAllowed ? readRequestedTestRole(req) : null;
  const resolvedRole = requestedTestRole ?? defaultRole;

  // run shared lookup once
  const householdPromise = repo.resolveHouseholdStudentContextForUser(canonicalUserId);
  const studentProfilePromise = repo.resolveStudentProfileForStudentUser(canonicalUserId);
  const authenticatedUserPromise = repo.resolveUserBasicInfo(canonicalUserId);
  const previewStudentContextPromise =
    testContextAllowed && requestedTestRole ? repo.resolveDefaultPreviewStudentContext() : Promise.resolve(null);

  if (resolvedRole === "student") {
    let [student, household, authenticatedUser, previewStudentContext] = await Promise.all([
      studentProfilePromise,
      householdPromise,
      authenticatedUserPromise,
      previewStudentContextPromise,
    ]);

    if (!student?.studentProfileId && requestedTestRole === "student" && previewStudentContext?.studentProfileId) {
      student = { studentProfileId: previewStudentContext.studentProfileId };
      household = {
        householdId: previewStudentContext.householdId ?? null,
        studentProfileId: previewStudentContext.studentProfileId ?? null,
        studentUserId: previewStudentContext.studentUserId ?? null,
        roleInHousehold: "student",
        studentFirstName: previewStudentContext.studentFirstName ?? null,
        studentLastName: previewStudentContext.studentLastName ?? null,
        studentPreferredName: previewStudentContext.studentPreferredName ?? null,
      };
    }

    if (!student?.studentProfileId) {
      const studentProfileId = stableId("student_profile", auth.userId);
      await studentWriteRepo.upsertStudentProfile({
        studentProfileId,
        userId: canonicalUserId,
        householdId: household?.householdId ?? null,
      });

      student = await repo.resolveStudentProfileForStudentUser(canonicalUserId);
    }

    const introOnboarding = buildIntroOnboardingView(authenticatedUser);

    return {
      authenticatedUserId: canonicalUserId,
      authenticatedRoleType: resolvedRole,
      primaryPersona: effectivePermissions.primaryPersona,
      householdId: household?.householdId ?? null,
      studentProfileId:
        student?.studentProfileId ??
        household?.studentProfileId ??
        null,
      studentUserId: household?.studentUserId ?? canonicalUserId,
      accountStatus: account.accountStatus,
      authProvider: account.authProvider,
      isSuperAdmin: account.isSuperAdmin,
      effectiveCapabilities: effectivePermissions.grantedCapabilities,
      deniedCapabilities: effectivePermissions.deniedCapabilities,
      activeMemberships: memberships.map((membership) => ({
        householdId: membership.householdId,
        householdName: membership.householdName,
        roleInHousehold: membership.roleInHousehold,
        membershipStatus: membership.membershipStatus,
        isPrimary: membership.isPrimary,
      })),
      email: auth.email,
      authenticatedFirstName: authenticatedUser?.firstName ?? null,
      authenticatedLastName: authenticatedUser?.lastName ?? null,
      authenticatedPreferredName: authenticatedUser?.preferredName ?? null,
      hasCompletedIntroOnboarding: introOnboarding.hasCompletedIntroOnboarding,
      introOnboardingCompletedAt: introOnboarding.introOnboardingCompletedAt,
      introOnboardingSkippedAt: introOnboarding.introOnboardingSkippedAt,
      introOnboardingVersion: introOnboarding.introOnboardingVersion,
      introOnboardingStatus: introOnboarding.introOnboardingStatus,
      introOnboardingShouldAutoShow: introOnboarding.shouldAutoShow,
      currentIntroOnboardingVersion: introOnboarding.currentVersion,
      studentFirstName: authenticatedUser?.firstName ?? household?.studentFirstName ?? null,
      studentLastName: authenticatedUser?.lastName ?? household?.studentLastName ?? null,
      studentPreferredName: authenticatedUser?.preferredName ?? household?.studentPreferredName ?? null,
      testContextSwitchingEnabled: testContextAllowed,
      testContextAllowedRoles: testContextAllowed ? ["student", "parent", "coach"] : [],
      testContextOverrideRole: requestedTestRole,
    };
  }

  let [household, student, authenticatedUser, previewStudentContext] = await Promise.all([
    householdPromise,
    studentProfilePromise,
    authenticatedUserPromise,
    previewStudentContextPromise,
  ]);

  if (!household?.studentProfileId && requestedTestRole && previewStudentContext?.studentProfileId) {
    household = {
      householdId: previewStudentContext.householdId ?? null,
      studentProfileId: previewStudentContext.studentProfileId ?? null,
      studentUserId: previewStudentContext.studentUserId ?? null,
      roleInHousehold:
        requestedTestRole === "parent" ? "parent" : requestedTestRole === "coach" ? "coach" : "student",
      studentFirstName: previewStudentContext.studentFirstName ?? null,
      studentLastName: previewStudentContext.studentLastName ?? null,
      studentPreferredName: previewStudentContext.studentPreferredName ?? null,
    };
  }

  if (!student?.studentProfileId && requestedTestRole === "student" && previewStudentContext?.studentProfileId) {
    student = {
      studentProfileId: previewStudentContext.studentProfileId,
    };
  }
  const introOnboarding = buildIntroOnboardingView(authenticatedUser);

  return {
    authenticatedUserId: canonicalUserId,
    authenticatedRoleType: resolvedRole,
    primaryPersona: effectivePermissions.primaryPersona,
    householdId: household?.householdId ?? null,
    studentProfileId: household?.studentProfileId ?? student?.studentProfileId ?? null,
    studentUserId: household?.studentUserId ?? canonicalUserId,
    accountStatus: account.accountStatus,
    authProvider: account.authProvider,
    isSuperAdmin: account.isSuperAdmin,
    effectiveCapabilities: effectivePermissions.grantedCapabilities,
    deniedCapabilities: effectivePermissions.deniedCapabilities,
    activeMemberships: memberships.map((membership) => ({
      householdId: membership.householdId,
      householdName: membership.householdName,
      roleInHousehold: membership.roleInHousehold,
      membershipStatus: membership.membershipStatus,
      isPrimary: membership.isPrimary,
    })),
    email: auth.email,
    authenticatedFirstName: authenticatedUser?.firstName ?? null,
    authenticatedLastName: authenticatedUser?.lastName ?? null,
    authenticatedPreferredName: authenticatedUser?.preferredName ?? null,
    hasCompletedIntroOnboarding: introOnboarding.hasCompletedIntroOnboarding,
    introOnboardingCompletedAt: introOnboarding.introOnboardingCompletedAt,
    introOnboardingSkippedAt: introOnboarding.introOnboardingSkippedAt,
    introOnboardingVersion: introOnboarding.introOnboardingVersion,
    introOnboardingStatus: introOnboarding.introOnboardingStatus,
    introOnboardingShouldAutoShow: introOnboarding.shouldAutoShow,
    currentIntroOnboardingVersion: introOnboarding.currentVersion,
    studentFirstName: household?.studentFirstName ?? null,
    studentLastName: household?.studentLastName ?? null,
    studentPreferredName: household?.studentPreferredName ?? null,
    testContextSwitchingEnabled: testContextAllowed,
    testContextAllowedRoles: testContextAllowed ? ["student", "parent", "coach"] : [],
    testContextOverrideRole: requestedTestRole,
  };
}
