import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import type { CapabilityKey, Persona } from "../../../../packages/shared/src/capabilities";
import type { HouseholdAdminOverview, SignupDecision } from "../../../../packages/shared/src/contracts/admin";
import { getAuthenticatedUser } from "../middleware/auth";
import { householdAdminRepository } from "../repositories/households/householdAdminRepository";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { isReturningSuperUserIdentity } from "../services/auth/superAdminIdentity";
import { householdAdminService } from "../services/households/householdAdminService";
import { readJsonBody } from "../utils/body";
import { AppError } from "../utils/appError";
import { badRequest, json, unauthorized } from "../utils/http";

const createHouseholdSchema = z.object({
  persona: z.enum(["parent", "admin"]).default("parent"),
  householdName: z.string().trim().min(1).max(180),
});

const requestAccessSchema = z.object({
  requestedPersona: z.enum(["student", "coach"]),
  parentEmail: z.string().trim().email(),
  requestMessage: z.string().trim().max(2000).optional().nullable(),
});

const acceptInvitationSchema = z.object({
  token: z.string().trim().min(20).max(512),
});

const inviteSchema = z.object({
  householdId: z.string().uuid().optional().nullable(),
  invitedEmail: z.string().trim().email(),
  invitedPersona: z.enum(["student", "coach"]),
});

const joinRequestIdSchema = z.object({
  householdJoinRequestId: z.string().uuid(),
});

const permissionUpdateSchema = z.object({
  householdId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid(),
  persona: z.enum(["student", "parent", "coach", "admin"]),
  grants: z.array(z.string()).default([]),
  denies: z.array(z.string()).default([]),
});

function searchParams(req: IncomingMessage) {
  return new URL(req.url || "/", "http://localhost").searchParams;
}

function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ") || "Invalid request body";
}

async function parseBody<T extends z.ZodTypeAny>(req: IncomingMessage, res: ServerResponse, schema: T) {
  try {
    const parsed = schema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      badRequest(res, formatZodError(parsed.error));
      return null;
    }
    return parsed.data;
  } catch {
    badRequest(res, "Invalid JSON body");
    return null;
  }
}

function normalizeCapabilities(values: string[]): CapabilityKey[] {
  return values.filter(Boolean) as CapabilityKey[];
}

function normalizeAuthenticatedPersona(role: string | null | undefined): Persona {
  if (role === "parent" || role === "coach" || role === "admin") {
    return role;
  }
  return "student";
}

function buildManualSignupDecision(role: Persona): SignupDecision {
  if (role === "admin") {
    return {
      state: "admin_ready",
      role: "admin",
      householdId: null,
      householdName: null,
    };
  }

  return {
    state: role === "parent" ? "needs_parent_household" : "needs_household_request",
    role,
    householdId: null,
    householdName: null,
  };
}

function errorInfo(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: error instanceof AppError ? error.code : "unknown_error",
    };
  }

  return {
    message: String(error),
    code: "unknown_error",
  };
}

async function getSignupDecisionWithRouteFallback(req: IncomingMessage): Promise<SignupDecision> {
  const inviteToken = searchParams(req).get("inviteToken");

  try {
    const ctx = await resolveRequestContext(req);
    return householdAdminService.getSignupDecision(ctx, inviteToken);
  } catch (error) {
    const auth = await getAuthenticatedUser(req);
    const canFallback =
      error instanceof AppError
        && (error.code === "auth_user_sync_failed" || error.code === "auth_role_resolution_failed");

    if (!auth || (!canFallback && !isReturningSuperUserIdentity(auth))) {
      throw error;
    }

    if (!canFallback && !isReturningSuperUserIdentity(auth)) {
      throw new Error("UNAUTHENTICATED");
    }

    if (inviteToken) {
      const invitation = await householdAdminService.previewInvitation(inviteToken);
      return {
        state: "pending_invitation_acceptance",
        role: invitation.invitedPersona,
        householdId: invitation.householdId,
        householdName: invitation.householdName ?? null,
        invitationPreview: {
          invitedPersona: invitation.invitedPersona,
          householdName: invitation.householdName ?? null,
          inviterName: null,
          expiresAt: invitation.expiresAt,
        },
      };
    }

    const role = normalizeAuthenticatedPersona(auth.roleType);
    const info = errorInfo(error);
    console.error("Signup decision route fallback engaged", {
      authenticatedUserId: auth.userId,
      upstreamRoleType: auth.roleType,
      errorCode: info.code,
      errorMessage: info.message,
    });
    return buildManualSignupDecision(role);
  }
}

async function getHouseholdAdminOverviewWithRouteFallback(
  req: IncomingMessage
): Promise<{
  overview: HouseholdAdminOverview;
  editableCapabilitiesByPersona: Record<Persona, unknown>;
}> {
  const requestedHouseholdId = searchParams(req).get("householdId");

  try {
    const ctx = await resolveRequestContext(req);
    const overview = await householdAdminService.buildAdminOverview(ctx, requestedHouseholdId);
    return {
      overview,
      editableCapabilitiesByPersona: {
        student: householdAdminService.listEditableCapabilitiesForPersona("student"),
        parent: householdAdminService.listEditableCapabilitiesForPersona("parent"),
        coach: householdAdminService.listEditableCapabilitiesForPersona("coach"),
        admin: householdAdminService.listEditableCapabilitiesForPersona("admin"),
      } satisfies Record<Persona, unknown>,
    };
  } catch (error) {
    const auth = await getAuthenticatedUser(req);
    const canFallback =
      error instanceof AppError
        && (error.code === "auth_user_sync_failed" || error.code === "auth_role_resolution_failed");

    if (!auth || !canFallback || !isReturningSuperUserIdentity(auth)) {
      throw error;
    }

    const info = errorInfo(error);
    console.error("Household admin overview route fallback engaged", {
      authenticatedUserId: auth.userId,
      upstreamRoleType: auth.roleType,
      errorCode: info.code,
      errorMessage: info.message,
    });

    const overview = await householdAdminService.buildAdminOverview(
      {
        authenticatedUserId: auth.userId,
        authenticatedRoleType: "admin",
        primaryPersona: "admin",
        householdId: requestedHouseholdId ?? null,
        studentProfileId: null,
        studentUserId: null,
        isSuperAdmin: true,
        effectiveCapabilities: ["access_admin_console", "manage_household", "manage_permissions", "view_household_admin"],
        deniedCapabilities: [],
        activeMemberships: [],
        email: auth.email,
      },
      requestedHouseholdId
    );

    return {
      overview,
      editableCapabilitiesByPersona: {
        student: householdAdminService.listEditableCapabilitiesForPersona("student"),
        parent: householdAdminService.listEditableCapabilitiesForPersona("parent"),
        coach: householdAdminService.listEditableCapabilitiesForPersona("coach"),
        admin: householdAdminService.listEditableCapabilitiesForPersona("admin"),
      } satisfies Record<Persona, unknown>,
    };
  }
}

async function getSuperAdminDirectoryWithRouteFallback(req: IncomingMessage) {
  try {
    const ctx = await resolveRequestContext(req);
    return householdAdminService.listSuperAdminDirectory(ctx);
  } catch (error) {
    const auth = await getAuthenticatedUser(req);
    const canFallback =
      error instanceof AppError
        && (error.code === "auth_user_sync_failed" || error.code === "auth_role_resolution_failed");

    if (!auth || !canFallback || !isReturningSuperUserIdentity(auth)) {
      throw error;
    }

    const info = errorInfo(error);
    console.error("Super-admin directory route fallback engaged", {
      authenticatedUserId: auth.userId,
      upstreamRoleType: auth.roleType,
      errorCode: info.code,
      errorMessage: info.message,
    });

    return householdAdminRepository.listSuperAdminDirectoryUsers();
  }
}

async function withAuthErrors(res: ServerResponse, handler: () => Promise<void>) {
  try {
    await handler();
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    if (error instanceof AppError) {
      return json(res, error.status, { error: error.code, message: error.message, details: error.details });
    }
    throw error;
  }
}

export async function signupDecisionRoute(req: IncomingMessage, res: ServerResponse) {
  return withAuthErrors(res, async () => {
    const decision = await getSignupDecisionWithRouteFallback(req);
    return json(res, 200, { ok: true, decision });
  });
}

export async function signupCreateHouseholdRoute(req: IncomingMessage, res: ServerResponse) {
  return withAuthErrors(res, async () => {
    const ctx = await resolveRequestContext(req);
    const body = await parseBody(req, res, createHouseholdSchema);
    if (!body) return;
    const household = await householdAdminService.createParentHousehold(ctx, body);
    return json(res, 200, { ok: true, household });
  });
}

export async function signupRequestHouseholdAccessRoute(req: IncomingMessage, res: ServerResponse) {
  return withAuthErrors(res, async () => {
    const ctx = await resolveRequestContext(req);
    const body = await parseBody(req, res, requestAccessSchema);
    if (!body) return;
    const targetHousehold = await householdAdminService.requestHouseholdAccess(ctx, body);
    return json(res, 200, { ok: true, targetHousehold });
  });
}

export async function invitationPreviewRoute(req: IncomingMessage, res: ServerResponse) {
  const token = searchParams(req).get("token");
  if (!token) {
    return badRequest(res, "token is required");
  }
  return withAuthErrors(res, async () => {
    const invitation = await householdAdminService.previewInvitation(token);
    return json(res, 200, { ok: true, invitation });
  });
}

export async function invitationAcceptRoute(req: IncomingMessage, res: ServerResponse) {
  return withAuthErrors(res, async () => {
    const ctx = await resolveRequestContext(req);
    const body = await parseBody(req, res, acceptInvitationSchema);
    if (!body) return;
    const household = await householdAdminService.acceptInvitation(ctx, body.token);
    return json(res, 200, { ok: true, household });
  });
}

export async function householdAdminOverviewRoute(req: IncomingMessage, res: ServerResponse) {
  return withAuthErrors(res, async () => {
    const response = await getHouseholdAdminOverviewWithRouteFallback(req);
    return json(res, 200, {
      ok: true,
      overview: response.overview,
      editableCapabilitiesByPersona: response.editableCapabilitiesByPersona,
    });
  });
}

export async function householdInvitationListRoute(req: IncomingMessage, res: ServerResponse) {
  return householdAdminOverviewRoute(req, res);
}

export async function householdInvitationCreateRoute(req: IncomingMessage, res: ServerResponse) {
  return withAuthErrors(res, async () => {
    const ctx = await resolveRequestContext(req);
    const body = await parseBody(req, res, inviteSchema);
    if (!body) return;
    const invitation = await householdAdminService.inviteMember(ctx, body);
    return json(res, 200, { ok: true, invitation });
  });
}

export async function householdJoinRequestApproveRoute(req: IncomingMessage, res: ServerResponse) {
  return withAuthErrors(res, async () => {
    const ctx = await resolveRequestContext(req);
    const body = await parseBody(req, res, joinRequestIdSchema);
    if (!body) return;
    await householdAdminService.approveJoinRequest(ctx, body);
    const overview = await householdAdminService.buildAdminOverview(ctx, ctx.householdId);
    return json(res, 200, { ok: true, overview });
  });
}

export async function householdJoinRequestDenyRoute(req: IncomingMessage, res: ServerResponse) {
  return withAuthErrors(res, async () => {
    const ctx = await resolveRequestContext(req);
    const body = await parseBody(req, res, joinRequestIdSchema);
    if (!body) return;
    await householdAdminService.denyJoinRequest(ctx, body);
    const overview = await householdAdminService.buildAdminOverview(ctx, ctx.householdId);
    return json(res, 200, { ok: true, overview });
  });
}

export async function householdPermissionUpdateRoute(req: IncomingMessage, res: ServerResponse) {
  return withAuthErrors(res, async () => {
    const ctx = await resolveRequestContext(req);
    const body = await parseBody(req, res, permissionUpdateSchema);
    if (!body) return;
    const overview = await householdAdminService.updateMemberPermissions(ctx, {
      householdId: body.householdId ?? null,
      userId: body.userId,
      persona: body.persona,
      grants: normalizeCapabilities(body.grants),
      denies: normalizeCapabilities(body.denies),
    });
    return json(res, 200, { ok: true, overview });
  });
}

export async function superAdminUserDirectoryRoute(req: IncomingMessage, res: ServerResponse) {
  return withAuthErrors(res, async () => {
    const users = await getSuperAdminDirectoryWithRouteFallback(req);
    return json(res, 200, { ok: true, users });
  });
}
