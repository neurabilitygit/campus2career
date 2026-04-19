import type { IncomingMessage, ServerResponse } from "node:http";
import { demoFinanceAnalystScoringInput } from "../fixtures/demoStudentScoringInput";
import { runScoring } from "../services/scoring";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { buildStudentScoringInput } from "../services/student/aggregateStudentContext";
import { unauthorized, badRequest, json } from "../utils/http";

/**
 * Fixed payload for local docs, Storybook, or a “sample scoring” dev panel.
 * Prefer GET /students/me/scoring for real user context.
 */
export async function scoringRoute(_req: IncomingMessage, res: ServerResponse) {
  const demo = runScoring(demoFinanceAnalystScoringInput);

  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(demo, null, 2));
}

export async function scoringLiveRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);

    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const scoringInput = await buildStudentScoringInput(ctx.studentProfileId);
    const scoring = runScoring(scoringInput);

    return json(res, 200, { scoring, resolvedContext: ctx });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}
