import crypto from "node:crypto";
import type { IncomingMessage } from "node:http";
import { getAuthenticatedUser } from "../../middleware/auth";
import { UserContextRepository } from "../../repositories/auth/userContextRepository";
import { StudentWriteRepository } from "../../repositories/student/studentWriteRepository";
import { AppError } from "../../utils/appError";
import { syncAuthenticatedUser } from "./syncAuthenticatedUser";

export interface RequestContext {
  authenticatedUserId: string;
  authenticatedRoleType: "student" | "parent" | "coach" | "admin";
  householdId: string | null;
  studentProfileId: string | null;
  studentUserId: string | null;
  email?: string;
  authenticatedFirstName?: string | null;
  authenticatedLastName?: string | null;
  authenticatedPreferredName?: string | null;
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
  await syncAuthenticatedUser(auth);

  const resolvedRoleRaw =
    (await repo.resolveApplicationRoleForUser(auth.userId)) || auth.roleType;

  const defaultRole = normalizeRole(resolvedRoleRaw);
  if (!defaultRole) {
    throw new AppError({
      status: 503,
      code: "auth_role_resolution_failed",
      message:
        "Authenticated role could not be resolved from the current user and household wiring.",
      details: {
        authenticatedUserId: auth.userId,
        upstreamRoleType: auth.roleType || null,
        resolvedRoleRaw: resolvedRoleRaw || null,
      },
    });
  }
  const testContextAllowed = canUseTestContextSwitching(auth.email);
  const requestedTestRole = testContextAllowed ? readRequestedTestRole(req) : null;
  const resolvedRole = requestedTestRole ?? defaultRole;

  // run shared lookup once
  const householdPromise = repo.resolveHouseholdStudentContextForUser(auth.userId);
  const studentProfilePromise = repo.resolveStudentProfileForStudentUser(auth.userId);
  const authenticatedUserPromise = repo.resolveUserBasicInfo(auth.userId);

  if (resolvedRole === "student") {
    let [student, household, authenticatedUser] = await Promise.all([
      studentProfilePromise,
      householdPromise,
      authenticatedUserPromise,
    ]);

    if (!student?.studentProfileId) {
      const studentProfileId = stableId("student_profile", auth.userId);
      await studentWriteRepo.upsertStudentProfile({
        studentProfileId,
        userId: auth.userId,
        householdId: household?.householdId ?? null,
      });

      student = await repo.resolveStudentProfileForStudentUser(auth.userId);
    }

    return {
      authenticatedUserId: auth.userId,
      authenticatedRoleType: resolvedRole,
      householdId: household?.householdId ?? null,
      studentProfileId:
        student?.studentProfileId ??
        household?.studentProfileId ??
        null,
      studentUserId: auth.userId,
      email: auth.email,
      authenticatedFirstName: authenticatedUser?.firstName ?? null,
      authenticatedLastName: authenticatedUser?.lastName ?? null,
      authenticatedPreferredName: authenticatedUser?.preferredName ?? null,
      studentFirstName: authenticatedUser?.firstName ?? household?.studentFirstName ?? null,
      studentLastName: authenticatedUser?.lastName ?? household?.studentLastName ?? null,
      studentPreferredName: authenticatedUser?.preferredName ?? household?.studentPreferredName ?? null,
      testContextSwitchingEnabled: testContextAllowed,
      testContextAllowedRoles: testContextAllowed ? ["student", "parent", "coach"] : [],
      testContextOverrideRole: requestedTestRole,
    };
  }

  const [household, student, authenticatedUser] = await Promise.all([
    householdPromise,
    studentProfilePromise,
    authenticatedUserPromise,
  ]);

  return {
    authenticatedUserId: auth.userId,
    authenticatedRoleType: resolvedRole,
    householdId: household?.householdId ?? null,
    studentProfileId: household?.studentProfileId ?? student?.studentProfileId ?? null,
    studentUserId: household?.studentUserId ?? auth.userId,
    email: auth.email,
    authenticatedFirstName: authenticatedUser?.firstName ?? null,
    authenticatedLastName: authenticatedUser?.lastName ?? null,
    authenticatedPreferredName: authenticatedUser?.preferredName ?? null,
    studentFirstName: household?.studentFirstName ?? null,
    studentLastName: household?.studentLastName ?? null,
    studentPreferredName: household?.studentPreferredName ?? null,
    testContextSwitchingEnabled: testContextAllowed,
    testContextAllowedRoles: testContextAllowed ? ["student", "parent", "coach"] : [],
    testContextOverrideRole: requestedTestRole,
  };
}
