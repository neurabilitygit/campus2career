import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { AuthUserRepository } from "../repositories/auth/authUserRepository";
import { buildIntroOnboardingView } from "../services/auth/introOnboarding";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
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

export async function introOnboardingCompleteRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    const body = await parseStatusBody(req);
    if (body == null) {
      return badRequest(res, "Invalid onboarding update payload");
    }

    await repo.markIntroOnboardingCompleted(
      ctx.authenticatedUserId,
      body.introOnboardingVersion ?? ctx.currentIntroOnboardingVersion ?? 1
    );
    const state = buildIntroOnboardingView(await repo.getIntroOnboardingState(ctx.authenticatedUserId));
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
    const ctx = await resolveRequestContext(req);
    const body = await parseStatusBody(req);
    if (body == null) {
      return badRequest(res, "Invalid onboarding update payload");
    }

    await repo.markIntroOnboardingSkipped(
      ctx.authenticatedUserId,
      body.introOnboardingVersion ?? ctx.currentIntroOnboardingVersion ?? 1
    );
    const state = buildIntroOnboardingView(await repo.getIntroOnboardingState(ctx.authenticatedUserId));
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
    const ctx = await resolveRequestContext(req);
    const state = buildIntroOnboardingView(await repo.getIntroOnboardingState(ctx.authenticatedUserId));
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
