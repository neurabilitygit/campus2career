import crypto from "node:crypto";
import type { IncomingMessage } from "node:http";
import { getAuthenticatedUser } from "../../middleware/auth";
import { UserContextRepository } from "../../repositories/auth/userContextRepository";
import { StudentWriteRepository } from "../../repositories/student/studentWriteRepository";
import { syncAuthenticatedUser } from "./syncAuthenticatedUser";

export interface RequestContext {
  authenticatedUserId: string;
  authenticatedRoleType: "student" | "parent" | "coach" | "admin";
  householdId: string | null;
  studentProfileId: string | null;
  studentUserId: string | null;
  email?: string;
  testContextSwitchingEnabled?: boolean;
  testContextAllowedRoles?: Array<"student" | "parent" | "coach">;
  testContextOverrideRole?: "student" | "parent" | "coach" | null;
}

const repo = new UserContextRepository();
const studentWriteRepo = new StudentWriteRepository();

function normalizeRole(role: string | null | undefined): RequestContext["authenticatedRoleType"] {
  if (role === "student" || role === "parent" || role === "coach" || role === "admin") {
    return role;
  }
  // safe fallback
  return "student";
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
  const testContextAllowed = canUseTestContextSwitching(auth.email);
  const requestedTestRole = testContextAllowed ? readRequestedTestRole(req) : null;
  const resolvedRole = requestedTestRole ?? defaultRole;

  // run shared lookup once
  const householdPromise = repo.resolveHouseholdStudentContextForUser(auth.userId);
  const studentProfilePromise = repo.resolveStudentProfileForStudentUser(auth.userId);

  if (resolvedRole === "student") {
    let [student, household] = await Promise.all([
      studentProfilePromise,
      householdPromise,
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
      testContextSwitchingEnabled: testContextAllowed,
      testContextAllowedRoles: testContextAllowed ? ["student", "parent", "coach"] : [],
      testContextOverrideRole: requestedTestRole,
    };
  }

  const [household, student] = await Promise.all([
    householdPromise,
    studentProfilePromise,
  ]);

  return {
    authenticatedUserId: auth.userId,
    authenticatedRoleType: resolvedRole,
    householdId: household?.householdId ?? null,
    studentProfileId: household?.studentProfileId ?? student?.studentProfileId ?? null,
    studentUserId: household?.studentUserId ?? auth.userId,
    email: auth.email,
    testContextSwitchingEnabled: testContextAllowed,
    testContextAllowedRoles: testContextAllowed ? ["student", "parent", "coach"] : [],
    testContextOverrideRole: requestedTestRole,
  };
}
