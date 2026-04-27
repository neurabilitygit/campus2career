import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import {
  CURRENT_INTRO_ONBOARDING_VERSION,
} from "../../../../packages/shared/src/contracts/introOnboarding";
import { getAuthenticatedUser } from "../middleware/auth";
import { AuthUserRepository } from "../repositories/auth/authUserRepository";
import { buildIntroOnboardingView } from "../services/auth/introOnboarding";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { isReturningSuperUserIdentity } from "../services/auth/superAdminIdentity";
import { syncAuthenticatedUser } from "../services/auth/syncAuthenticatedUser";
import { AppError } from "../utils/appError";
import { readJsonBody } from "../utils/body";
import { badRequest, unauthorized, json } from "../utils/http";

const repo = new AuthUserRepository();

const statusBodySchema = z.object({
  introOnboardingVersion: z.number().int().positive().optional(),
});

export async function authMeRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    return json(res, 200, {
      authenticated: true,
      context: ctx,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    const auth = await getAuthenticatedUser(req);
    const canFallback =
      error instanceof AppError &&
      (error.code === "auth_user_sync_failed" || error.code === "auth_role_resolution_failed");
    if (auth && canFallback && isReturningSuperUserIdentity(auth)) {
      return json(res, 200, {
        authenticated: true,
        context: {
          authenticatedUserId: auth.userId,
          authenticatedRoleType: "admin",
          primaryPersona: "admin",
          householdId: null,
          studentProfileId: null,
          studentUserId: null,
          accountStatus: "active",
          authProvider: "demo-auth",
          isSuperAdmin: true,
          effectiveCapabilities: [
            "access_admin_console",
            "manage_household",
            "manage_permissions",
            "view_household_admin",
          ],
          deniedCapabilities: [],
          activeMemberships: [],
          email: auth.email,
          authenticatedFirstName: auth.firstName ?? "Eric",
          authenticatedLastName: auth.lastName ?? "Bass",
          authenticatedPreferredName: auth.preferredName ?? "Eric",
          hasCompletedIntroOnboarding: true,
          introOnboardingCompletedAt: null,
          introOnboardingSkippedAt: null,
          introOnboardingVersion: 1,
          introOnboardingStatus: "completed",
          introOnboardingShouldAutoShow: false,
          currentIntroOnboardingVersion: 1,
          studentFirstName: null,
          studentLastName: null,
          studentPreferredName: null,
          testContextSwitchingEnabled: true,
          testContextAllowedRoles: ["student", "parent", "coach"],
          testContextOverrideRole: null,
        },
      });
    }
    throw error;
  }
}

async function parseStatusBody(req: IncomingMessage) {
  try {
    const parsed = statusBodySchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

async function getIntroOnboardingActor(req: IncomingMessage) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return null;
  }

  const canonicalUserId = await syncAuthenticatedUser(auth);

  return {
    auth,
    canonicalUserId,
  };
}

export async function introOnboardingCompleteRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const actor = await getIntroOnboardingActor(req);
    if (!actor) {
      return unauthorized(res);
    }
    const body = await parseStatusBody(req);
    if (body == null) {
      return badRequest(res, "Invalid onboarding update payload");
    }

    await repo.markIntroOnboardingCompleted(
      actor.canonicalUserId,
      body.introOnboardingVersion ?? CURRENT_INTRO_ONBOARDING_VERSION
    );
    const state = buildIntroOnboardingView(await repo.getIntroOnboardingState(actor.canonicalUserId));
    return json(res, 200, { ok: true, onboarding: state });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function introOnboardingSkipRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const actor = await getIntroOnboardingActor(req);
    if (!actor) {
      return unauthorized(res);
    }
    const body = await parseStatusBody(req);
    if (body == null) {
      return badRequest(res, "Invalid onboarding update payload");
    }

    await repo.markIntroOnboardingSkipped(
      actor.canonicalUserId,
      body.introOnboardingVersion ?? CURRENT_INTRO_ONBOARDING_VERSION
    );
    const state = buildIntroOnboardingView(await repo.getIntroOnboardingState(actor.canonicalUserId));
    return json(res, 200, { ok: true, onboarding: state });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function introOnboardingReplayRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const actor = await getIntroOnboardingActor(req);
    if (!actor) {
      return unauthorized(res);
    }
    const state = buildIntroOnboardingView(await repo.getIntroOnboardingState(actor.canonicalUserId));
    return json(res, 200, {
      ok: true,
      onboarding: state,
      replayAvailable: true,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}
