import type { IncomingMessage } from "node:http";
import { getAuthenticatedUser } from "../../middleware/auth";
import { UserContextRepository } from "../../repositories/auth/userContextRepository";
import { syncAuthenticatedUser } from "./syncAuthenticatedUser";

export interface RequestContext {
  authenticatedUserId: string;
  authenticatedRoleType: "student" | "parent" | "coach" | "admin";
  householdId: string | null;
  studentProfileId: string | null;
  studentUserId: string | null;
  email?: string;
}

const repo = new UserContextRepository();

function normalizeRole(role: string | null | undefined): RequestContext["authenticatedRoleType"] {
  if (role === "student" || role === "parent" || role === "coach" || role === "admin") {
    return role;
  }
  // safe fallback
  return "student";
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

  const resolvedRole = normalizeRole(resolvedRoleRaw);

  // run shared lookup once
  const householdPromise = repo.resolveHouseholdStudentContextForUser(auth.userId);

  if (resolvedRole === "student") {
    const [student, household] = await Promise.all([
      repo.resolveStudentProfileForStudentUser(auth.userId),
      householdPromise,
    ]);

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
    };
  }

  const household = await householdPromise;

  return {
    authenticatedUserId: auth.userId,
    authenticatedRoleType: resolvedRole,
    householdId: household?.householdId ?? null,
    studentProfileId: household?.studentProfileId ?? null,
    studentUserId: household?.studentUserId ?? null,
    email: auth.email,
  };
}