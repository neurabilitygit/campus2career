import type { IncomingMessage, ServerResponse } from "node:http";
import { ParentBriefRepository } from "../repositories/briefs/parentBriefRepository";
import { runScoring } from "../services/scoring";
import { generateAndPersistParentBrief } from "../services/briefs/orchestrator";
import { resolveBriefMonthLabel } from "../services/briefs/briefMonth";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { unauthorized, badRequest, forbidden, json } from "../utils/http";
import { buildStudentScoringInput } from "../services/student/aggregateStudentContext";

const repo = new ParentBriefRepository();

function canManageParentBriefs(role: string): boolean {
  return role === "parent" || role === "coach" || role === "admin";
}

/** GET — persisted brief for the current reporting month (see `resolveBriefMonthLabel`). */
export async function parentBriefGetLiveRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);

    if (!canManageParentBriefs(ctx.authenticatedRoleType)) {
      return forbidden(res, "This endpoint is only available to parent, coach, or admin roles");
    }

    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const monthLabel = resolveBriefMonthLabel(new Date());
    const brief = await repo.findForContextAndMonth({
      studentProfileId: ctx.studentProfileId,
      householdId: ctx.householdId,
      monthLabel,
    });

    return json(res, 200, { brief, monthLabel, resolvedContext: ctx });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

/** POST — run scoring + LLM orchestration and upsert the row for the current reporting month. */
export async function parentBriefGenerateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);

    if (!canManageParentBriefs(ctx.authenticatedRoleType)) {
      return forbidden(res, "This endpoint is only available to parent, coach, or admin roles");
    }

    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const monthLabel = resolveBriefMonthLabel(new Date());
    const scoring = runScoring(await buildStudentScoringInput(ctx.studentProfileId));

    const result = await generateAndPersistParentBrief({
      studentProfileId: ctx.studentProfileId,
      householdId: ctx.householdId,
      monthLabel,
      scoring,
    });

    return json(res, 200, { ...result, monthLabel });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}
